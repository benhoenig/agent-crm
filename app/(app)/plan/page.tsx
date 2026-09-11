import { PageHeader } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { getPlan } from "@/lib/repo/plan";
import { optionKeys, optionsFor } from "@/lib/repo/options";
import { PlanBrowser } from "@/components/plan/PlanBrowser";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const viewer = await getViewer();
  const [plan, taskTypeRows, actionCategories] = await Promise.all([
    getPlan(viewer.userId),
    optionsFor("task_type"),
    // The sheet on this page could set a task type but never an activity
    // category, so a target set on the dashboard could be READ here and not
    // changed. Same picklist as the dashboard, so both sheets offer the same
    // vocabulary (0026).
    optionKeys("action_category"),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="แผนงานทั้งหมด"
        sub="ทุกงานในที่เดียว — อะไรเลยกำหนด อะไรยังไม่ได้จัดเวลา อะไรเสร็จแล้ว · ย้อนหลัง 1 ปี"
      />
      <PlanBrowser
        initial={plan}
        taskTypes={taskTypeRows.map((o) => ({ key: o.key, tone: o.tone }))}
        actionCategories={actionCategories}
      />
    </div>
  );
}
