import { COOKIE_PREFIX } from "@/lib/brand";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { generateState, parseState } from "better-auth/oauth2";
import { line } from "better-auth/social-providers";
import type { BetterAuthPlugin } from "better-auth";
import { and, eq, isNull, ne } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Sign in with LINE (Ben, 2026-08-26).
 *
 * WHY THIS EXISTS. Verifying a password means running scrypt, which is
 * deliberately slow — ~64 ms even on native node:crypto (lib/auth/password.ts)
 * against the 10 ms CPU ceiling of the Workers Free plan. Live sign-in failed
 * on every cold isolate. LINE sign-in never checks a password: the expensive
 * work happens on LINE's servers, and all this worker does is a token exchange
 * (network I/O, not CPU) plus one indexed lookup. It removes the cause rather
 * than working around it. Password sign-in stays as the admin break-glass.
 *
 * WHY A PLUGIN AND NOT `socialProviders.line`. Better Auth's stock social flow
 * matches an OAuth identity to a user by the `accounts` table, falling back to
 * linking by EMAIL. Neither works here: staff are provisioned by the HR import
 * with work emails, while their LINE accounts carry personal ones (when they
 * carry any at all — the `email` scope needs a separate application to LINE,
 * which is why the default scope set is disabled below). Our binding key is
 * `users.line_user_id`, so the identity→user step has to be ours. Everything
 * else — PKCE, state, the token exchange, session creation, the cookie — is
 * Better Auth's own code, reached through its documented extension points.
 *
 * WHY THE SAME COLUMN AS THE BOT. LINE issues user ids per PROVIDER, not per
 * channel: "as long as channels have the same provider, regardless of whether
 * the channel is for LINE Login or Messaging API, the same user ID is used"
 * (developers.line.biz FAQ). So the Login channel MUST be created under the
 * same provider as the existing Messaging API channel — and then a person who
 * already ran `/link` in a LINE group can sign in immediately, with no second
 * binding step. One column, one source of truth, both directions.
 *
 * ENDPOINTS (mounted under /api/auth):
 *   POST /sign-in/line      → returns the LINE authorize URL
 *   GET  /line/callback     → bound: signs in · unbound: → /login/claim
 *   GET  /line/claim-options → the unclaimed staff list (claim cookie required)
 *   POST /line/claim        → binds this LINE id to a person, then signs in
 */

const CLAIM_COOKIE = `${COOKIE_PREFIX}.line_claim`;
const CLAIM_TTL_SECONDS = 10 * 60;

/** Where an unbound LINE identity is parked while the person picks a name. */
type ClaimPayload = { sub: string; name: string; expiresAt: number };

function credentials() {
  const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
  const clientSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** True when the LINE Login channel is configured — the button hides if not. */
export const lineLoginConfigured = () => credentials() !== null;

function provider() {
  const creds = credentials();
  if (!creds) return null;
  return line({
    ...creds,
    // The provider's defaults ask for `email`, and LINE rejects that scope
    // until you file a separate application for it. We never use the address
    // (binding is by LINE user id), so asking for it would trade a working
    // login for a form on LINE's console.
    disableDefaultScope: true,
    scope: ["openid", "profile"],
  });
}

/** `${origin}/api/auth` → the app origin, for redirects into normal pages. */
const appOrigin = (baseURL: string) => new URL(baseURL).origin;

export const lineLogin = () =>
  ({
    id: "line-login",
    endpoints: {
      /**
       * Mirrors Better Auth's own /sign-in/social: the browser POSTs, we hand
       * back a URL, the client navigates. generateState stores the PKCE
       * verifier and the post-login destination against the state token.
       */
      signInLine: createAuthEndpoint(
        "/sign-in/line",
        {
          method: "POST",
          body: z.object({
            callbackURL: z.string().optional(),
            errorCallbackURL: z.string().optional(),
          }),
        },
        async (ctx) => {
          const lineProvider = provider();
          // ctx.json's status option only survives when the endpoint is
          // rendered asResponse; ctx.error is the path that always carries one.
          if (!lineProvider) {
            throw ctx.error("NOT_IMPLEMENTED", { error: "line_not_configured" });
          }
          const { state, codeVerifier } = await generateState(
            ctx,
            undefined,
            undefined
          );
          const url = await lineProvider.createAuthorizationURL({
            state,
            codeVerifier,
            redirectURI: `${ctx.context.baseURL}/line/callback`,
          });
          return ctx.json({ url: url.toString(), redirect: true });
        }
      ),

      /**
       * LINE sends the person back here. Two outcomes, and only two:
       * a known LINE id becomes a session, an unknown one becomes a claim.
       * A user is NEVER created — accounts come from HR, not from whoever
       * happens to tap the button.
       */
      lineCallback: createAuthEndpoint(
        "/line/callback",
        {
          method: "GET",
          query: z.object({
            code: z.string().optional(),
            state: z.string().optional(),
            error: z.string().optional(),
          }),
        },
        async (ctx) => {
          const lineProvider = provider();
          const origin = appOrigin(ctx.context.baseURL);
          const fail: (reason: string) => never = (reason) => {
            throw ctx.redirect(`${origin}/login?error=${reason}`);
          };
          if (!lineProvider) fail("line_not_configured");
          // The person hit "ยกเลิก" on LINE's consent screen, or LINE refused.
          if (ctx.query.error || !ctx.query.code) fail("line_cancelled");
          const code = ctx.query.code;

          // parseState verifies the signed state cookie against ?state and
          // redirects on mismatch, so CSRF is handled before we touch LINE.
          const state = await parseState(ctx);

          const tokens = await lineProvider.validateAuthorizationCode({
            code,
            codeVerifier: state.codeVerifier,
            redirectURI: `${ctx.context.baseURL}/line/callback`,
          });
          const info = await lineProvider.getUserInfo(tokens);
          const sub = info?.user?.id;
          if (!sub) fail("line_no_profile");

          const [match] = await getDb()
            .select({ id: users.id, banned: users.banned })
            .from(users)
            .where(eq(users.lineUserId, sub))
            .limit(1);

          if (match) {
            // A departed employee keeps their LINE binding (so an admin can
            // see who it was) but must not get a session out of it.
            if (match.banned) fail("banned");
            const user = await ctx.context.internalAdapter.findUserById(
              match.id
            );
            if (!user) fail("line_no_account");
            const session = await ctx.context.internalAdapter.createSession(
              match.id
            );
            if (!session) fail("line_session_failed");
            await setSessionCookie(ctx, { session, user });
            throw ctx.redirect(
              new URL(state.callbackURL || "/", origin).toString()
            );
          }

          // Unknown LINE account. Park the verified identity in a signed,
          // short-lived cookie and send them to pick who they are. The cookie
          // is what proves the LINE round-trip actually happened — without it
          // /login/claim shows nothing and the claim endpoint refuses.
          const payload: ClaimPayload = {
            sub,
            name: info?.user?.name || "",
            expiresAt: Date.now() + CLAIM_TTL_SECONDS * 1000,
          };
          await ctx.setSignedCookie(
            CLAIM_COOKIE,
            JSON.stringify(payload),
            ctx.context.secret,
            {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              maxAge: CLAIM_TTL_SECONDS,
              secure: origin.startsWith("https://"),
            }
          );
          throw ctx.redirect(`${origin}/login/claim`);
        }
      ),

      /**
       * The picker's data. Behind the claim cookie so the staff roster is not
       * readable by anyone who simply visits /login/claim.
       */
      lineClaimOptions: createAuthEndpoint(
        "/line/claim-options",
        { method: "GET" },
        async (ctx) => {
          const claim = await readClaim(ctx);
          if (!claim) throw ctx.error("BAD_REQUEST", { error: "claim_expired" });
          return ctx.json({
            lineName: claim.name,
            people: await unclaimedPeople(),
          });
        }
      ),

      /**
       * Bind this LINE identity to a person, then sign them in.
       *
       * The guards match the bot's /link handler (app/api/line/webhook): an
       * account already bound to a different LINE stays bound, and one LINE
       * account cannot hold two staff accounts. Unbinding is an admin action
       * (ตั้งค่า → บัญชีผู้ใช้), which is the whole recovery story for a
       * mis-claim on a small team.
       */
      lineClaim: createAuthEndpoint(
        "/line/claim",
        { method: "POST", body: z.object({ userId: z.string() }) },
        async (ctx) => {
          const claim = await readClaim(ctx);
          if (!claim) throw ctx.error("BAD_REQUEST", { error: "claim_expired" });

          const db = getDb();
          const [target] = await db
            .select({ id: users.id, lineUserId: users.lineUserId })
            .from(users)
            .where(and(eq(users.id, ctx.body.userId), eq(users.banned, false)))
            .limit(1);
          if (!target) throw ctx.error("BAD_REQUEST", { error: "unknown_person" });
          if (target.lineUserId && target.lineUserId !== claim.sub) {
            throw ctx.error("CONFLICT", { error: "already_linked" });
          }
          const [holder] = await db
            .select({ id: users.id })
            .from(users)
            .where(
              and(eq(users.lineUserId, claim.sub), ne(users.id, target.id))
            )
            .limit(1);
          if (holder) throw ctx.error("CONFLICT", { error: "line_in_use" });

          // Conditional on still being unbound, so two people racing the same
          // name cannot both win — the second update matches no row.
          const bound = await db
            .update(users)
            .set({ lineUserId: claim.sub })
            .where(and(eq(users.id, target.id), isNull(users.lineUserId)))
            .returning({ id: users.id });
          if (bound.length === 0 && target.lineUserId !== claim.sub) {
            throw ctx.error("CONFLICT", { error: "already_linked" });
          }

          const user = await ctx.context.internalAdapter.findUserById(
            target.id
          );
          if (!user) throw ctx.error("BAD_REQUEST", { error: "unknown_person" });
          const session = await ctx.context.internalAdapter.createSession(
            target.id
          );
          if (!session) {
            throw ctx.error("INTERNAL_SERVER_ERROR", { error: "session_failed" });
          }
          await setSessionCookie(ctx, { session, user });
          ctx.setCookie(CLAIM_COOKIE, "", { path: "/", maxAge: 0 });
          return ctx.json({ redirect: true, url: "/" });
        }
      ),
    },
    // Claiming is the one unauthenticated write in the app, so it gets a
    // tighter limit than the global 100/min.
    rateLimit: [
      {
        pathMatcher: (path: string) =>
          path === "/line/claim" || path === "/sign-in/line",
        window: 60,
        max: 10,
      },
    ],
  }) satisfies BetterAuthPlugin;

/** Active staff nobody has bound a LINE account to yet. */
async function unclaimedPeople() {
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
      position: users.position,
    })
    .from(users)
    .where(and(eq(users.banned, false), isNull(users.lineUserId)))
    .orderBy(users.name);
}

async function readClaim(ctx: {
  getSignedCookie: (
    name: string,
    secret: string
  ) => Promise<string | false | null | undefined>;
  context: { secret: string };
}): Promise<ClaimPayload | null> {
  const raw = await ctx.getSignedCookie(CLAIM_COOKIE, ctx.context.secret);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ClaimPayload;
    if (!parsed.sub || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
