import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { getAgentOptions, getGoal } from "@/lib/repo/goals";
import { GoalForm } from "../../GoalForm";
import { updateGoal } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  const goal = await getGoal(viewer, id);
  if (!goal) notFound();

  const agents =
    viewer.perms.goals === "all" ? await getAgentOptions() : [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={`แก้ไขเป้าหมาย — ${goal.name}`} />
      <GoalForm
        action={updateGoal.bind(null, id)}
        goal={goal}
        agents={agents}
        viewerId={viewer.userId}
      />
    </div>
  );
}
