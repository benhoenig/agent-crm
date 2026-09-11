import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "./password";
import { lineLogin } from "./line-login";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    // Accounts are provisioned by an admin (/settings or
    // scripts/create-user.ts). Public self-signup stays off.
    disableSignUp: true,
    // Native node:crypto scrypt instead of the pure-JS @noble fallback the
    // workerd bundle would otherwise get — see lib/auth/password.ts. Same
    // parameters and hash format, so existing passwords still verify.
    password: { hash: hashPassword, verify: verifyPassword },
  },
  session: {
    // 30 days, refreshed on use (Ben, 2026-08-26). The default 7 was chosen by
    // Better Auth, not by us, and it means a week off = locked out — painful
    // while signing in is the fragile part. 30 rather than 90 because the
    // trade is real: a lost phone stays logged into the CRM for the whole
    // window, and this app shows owner phone numbers and buyer/seller ID
    // numbers. updateAge keeps a daily user signed in indefinitely.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      // Role is never client-settable; changed only via admin flows.
      role: { type: "string", input: false, defaultValue: "sales" },
    },
  },
  advanced: {
    database: { generateId: "uuid" },
  },
  // Login throttling (ports the Klaichan login_attempts idea via Better
  // Auth's own limiter). DATABASE storage — Workers isolates share no
  // memory, so counters must live in Postgres (rate_limits table) or the
  // limit resets on every cold start. Server-side auth.api calls bypass
  // this; the login form signs in through the HTTP endpoint, which counts.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
    // NOTE: no modelName here — with usePlural the adapter looks up
    // modelName+"s" in the schema, so the default "rateLimit" resolves to
    // our `rateLimits` export. Naming it "rateLimits" made it look for
    // "rateLimitss" and 500'd every password sign-in.
    customRules: {
      "/sign-in/email": { window: 300, max: 5 }, // 5 attempts / 5 min / IP
    },
  },
  // Admin plugin powers /settings account management: createUser,
  // setUserPassword, ban/unban ("deactivate" for departed employees).
  // Role CHANGES stay out of it — they go through our own server action so
  // the guard rules (can't demote yourself) live in one place.
  // nextCookies must stay last so server actions can set session cookies.
  plugins: [
    /* `roles` and `ac` are here ONLY to teach Better Auth the word
       "superadmin" (Ben, 2026-08-29). Its admin plugin validates adminRoles
       against its own registry, which ships with just `user` and `admin`, so
       renaming our role broke the build until superadmin was registered with
       the same grants `admin` had. This is Better Auth's access-control
       vocabulary for its OWN endpoints (createUser, setUserPassword, ban) —
       entirely separate from lib/auth/roles.ts, which governs the app. Nothing
       else reads it, and it is deliberately a copy of adminAc rather than a
       narrowing: this is the account-management API, and superadmin holds it. */
    admin({
      ac: createAccessControl(defaultStatements),
      roles: { superadmin: adminAc },
      adminRoles: ["superadmin"],
      defaultRole: "sales",
    }),
    // Sign in with LINE (lib/auth/line-login.ts). This is the everyday path
    // for staff — password sign-in runs scrypt, which does not fit inside the
    // Workers Free CPU budget, and is kept only as the admin break-glass.
    lineLogin(),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
