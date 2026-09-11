import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// Build stamp — "is the live site running the latest code?" is a real
// question. These are baked in at BUILD time and surfaced in the sidebar
// footer + /api/version, so the answer is visible instead of guessed.
//
// Vercel builds from a shallow checkout where `git` may not be on PATH, but
// it exposes the commit in VERCEL_GIT_COMMIT_SHA; that wins when present.
// Local builds ask git. Anything else is "unknown" rather than a failed build.
function gitRev(): string {
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercel) return vercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  /* Normally .next. Set NEXT_DIST_DIR to build somewhere else.

     WHY IT IS OVERRIDABLE. `next build` and `next dev` write DIFFERENT
     server-action manifests into this directory, so running a verification
     build while a dev server is up leaves the two mixed: the browser holds
     action ids minted by one and the server resolves against the other, and
     every server action dies with "was not found on the server" until the
     directory is thrown away. Nothing warns — the build succeeds, and the
     next click fails.

     So a check-it-compiles build gets its own directory and leaves the
     running dev server alone:

         NEXT_DIST_DIR=.next-verify npx next build --turbopack

     ONE CATCH: Next rewrites tsconfig.json on every build to register its own
     generated types, so a build under another distDir adds that directory's
     "types" glob to `include` (and reformats the file while it is in there).
     That edit is noise, not config — `git checkout -- tsconfig.json` after the
     build.

     Deploys are unaffected: Vercel sets nothing and gets .next. */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  env: {
    NEXT_PUBLIC_BUILD_REV: gitRev(),
    NEXT_PUBLIC_BUILT_AT: new Date().toISOString(),
  },
  experimental: {
    serverActions: {
      // media uploads (listing photos) post the file through a server action
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
