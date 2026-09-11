// GET /api/version — which build is actually live.
//
// Deploying is manual (`pnpm run deploy`), so code can sit committed but
// unshipped; that happened with Phase 5. This makes the answer checkable in
// one request, without a login:
//
//   curl -s https://<domain>/api/version
//
// Compare `rev` with `git rev-parse --short HEAD`. Deliberately minimal —
// a short commit hash of a private repo and a build timestamp, nothing about
// the environment, config, or data.

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      rev: process.env.NEXT_PUBLIC_BUILD_REV ?? "unknown",
      builtAt: process.env.NEXT_PUBLIC_BUILT_AT ?? null,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
