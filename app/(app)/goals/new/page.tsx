import { PageHeader } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { getAgentOptions } from "@/lib/repo/goals";
import { GoalForm } from "../GoalForm";
import { createGoal } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewGoalPage() {
  const viewer = await getViewer();
  const agents =
    viewer.perms.goals === "all" ? await getAgentOptions() : [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="ตั้งเป้าหมายใหม่" />
      <GoalForm action={createGoal} agents={agents} viewerId={viewer.userId} />
    </div>
  );
}
