import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/* Neon HTTP driver: stateless fetch per query — works identically in Node dev
   and on Cloudflare Workers. No interactive transactions; Better Auth's
   drizzle adapter doesn't use them, and app code must not either.

   ── Why there is a retry here ──────────────────────────────────────────
   Every request's FIRST database call is Better Auth's session lookup, from
   requireSession() in the root layout. One transient network failure there
   is a 500 on whatever page the user asked for — not a slow page, a broken
   one. With a single un-retried fetch per query the app sat one blip away
   from an error page at all times.

   ── Why it only retries SOME failures ─────────────────────────────────
   The driver POSTs the statement to Neon. If that request reached the server
   the statement may have RUN even though the response never came back —
   retrying would insert the deal twice. So the rule is narrow and provable
   rather than broad and hopeful:

     retried      the connection was never established (connect timeout, DNS
                  failure, connection refused). The bytes never left, so the
                  statement certainly did not run. Safe for writes too.

     not retried  anything ambiguous — ECONNRESET mid-flight, a socket
                  closing, an HTTP response carrying an error. The query may
                  have executed. A 500 the user can retry themselves beats a
                  duplicated commission row nobody notices.

   On the dev log that motivated this the split was 143 connect timeouts to
   28 resets, so the provably-safe class is the large majority of failures.

   A fetch that RESOLVES is never retried: an HTTP error response is the
   server answering, and answers are the caller's to interpret.            */

/** Attempts after the first. Low on purpose: a connect timeout costs ~10s,
    and a genuinely unreachable database should fail rather than hang. */
const RETRIES = 2;
const BACKOFF_MS = [150, 400];

/** True only for errors proving the request never reached Neon. Walks the
    cause chain — undici wraps the real code inside a TypeError. */
function neverReachedServer(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 6; depth++) {
    const cur = e as { code?: unknown; name?: unknown; cause?: unknown };
    if (
      cur.code === "UND_ERR_CONNECT_TIMEOUT" ||
      cur.code === "ENOTFOUND" ||
      cur.code === "EAI_AGAIN" ||
      cur.code === "ECONNREFUSED" ||
      cur.name === "ConnectTimeoutError"
    )
      return true;
    e = cur.cause;
  }
  return false;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Global by design: neonConfig is process-wide, so this also covers Better
// Auth's adapter — it shares getDb() but would not share a per-client option.
// The body the driver sends is a JSON string, so it is safe to re-send.
neonConfig.fetchFunction = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  for (let attempt = 0; ; attempt++) {
    // An abort the caller asked for is not a transport failure, and
    // neverReachedServer() does not match it, so it propagates untouched.
    try {
      return await fetch(input, init);
    } catch (err) {
      if (attempt >= RETRIES || !neverReachedServer(err)) throw err;
      console.warn(
        `[db] connection never opened (attempt ${attempt + 1}/${RETRIES + 1}) — retrying`
      );
      await sleep(BACKOFF_MS[attempt]);
    }
  }
};

let cached: NeonHttpDatabase<typeof schema> | null = null;

export function getDb() {
  if (!cached) {
    cached = drizzle(neon(process.env.DATABASE_URL!), { schema });
  }
  return cached;
}

export { schema };
