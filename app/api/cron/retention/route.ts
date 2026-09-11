// GET /api/cron/retention — nightly retention sweep for the access log.
//
// WHO CALLS IT. Vercel Cron, on the schedule in vercel.json (19:00 UTC =
// 02:00 in Bangkok, the quietest hour for the only office that uses this).
// Vercel sends `Authorization: Bearer ${CRON_SECRET}` on every invocation, and
// nothing without that header gets past the first line — the route is
// reachable from the internet (middleware.ts exempts /api/cron from the login
// redirect precisely so the scheduler can reach it), so the secret is the
// whole of its authentication.
//
// WHY IT EXISTS. ประวัติการเข้าดู records which colleague opened which โครงการ
// and how much of it — it exists so somebody walking off with the market
// research can be held to account, and the price of keeping a record like
// that is deleting it on schedule. The Habihub CRM this was cloned from ran
// the sweep from a Cloudflare Cron Trigger; on Vercel this route is the
// equivalent, calling the same sweepOldViews() that owns the delete.
//
// ERRORS PROPAGATE. A throw here is a 500 in the Vercel cron log, which is
// exactly where a failed sweep should be visible. Swallowing it would leave
// the retention promise silently unkept, with nothing anywhere saying so.

import { sweepOldViews } from "@/lib/repo/views";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const swept = await sweepOldViews();
  if (swept > 0) console.log(`[retention] swept ${swept} record_views rows`);
  return Response.json({ swept }, { headers: { "cache-control": "no-store" } });
}
