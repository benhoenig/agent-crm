/* แผนวันนี้ — the day, for anyone whose dashboard does not already carry it.

   NO LONGER IN THE SIDEBAR (Ben, 2026-08-28): the sales dashboard mounts the
   same PlanColumn, so a second entry point to the same components was a
   choice the reader had to make for no gain. The route stays because it is
   still the only place the day exists for a viewer whose dashboard is the
   team report.

   บันทึกกิจกรรม USED TO LIVE HERE as a seven-field form with today's actions
   in a table underneath. Both moved into PlanColumn as ActivityLogCard on the
   same day, so that logging sits next to the plan that feeds it — ticking a
   task with an action category writes the row (0019). This page is now a
   frame around the shared column and nothing else, which is the point: two
   copies of the day that could drift is exactly what it had become. */

import { PageHeader } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { optionKeys, optionsFor } from "@/lib/repo/options";
import { getFollowUps, getTodayActions } from "@/lib/repo/today";
import { getPlan } from "@/lib/repo/plan";
import { PlanColumn } from "@/components/plan/PlanColumn";
import { ListingPostQueue } from "@/components/today/ListingPostQueue";
import { bkkToday, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const viewer = await getViewer();
  const today = bkkToday();

  const [plan, taskTypeRows, followUps, activities, actionCategories] =
    await Promise.all([
      getPlan(viewer.userId),
      optionsFor("task_type"),
      getFollowUps(viewer),
      getTodayActions(viewer),
      optionKeys("action_category"),
    ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="แผนวันนี้" sub={formatDate(today)} />
      <PlanColumn
        initial={plan}
        taskTypes={taskTypeRows.map((o) => ({ key: o.key, tone: o.tone }))}
        followUps={followUps}
        activities={activities}
        actionCategories={actionCategories}
        afterDay={<ListingPostQueue viewer={viewer} />}
      />
    </div>
  );
}
