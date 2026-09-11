"use server";

// Goal mutations. Sales manage their own targets; roles with goals: "all"
// may create/edit anyone's. The scope fragment rides in every UPDATE WHERE.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { goals, goalStatus, recap } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { goalScope } from "@/lib/repo/goals";
import { dateStr, enumStr, numStr, reqStr, str } from "@/lib/forms";

function parseGoalForm(fd: FormData, canAssign: boolean, fallbackAgent: string) {
  return {
    name: reqStr(fd, "name"),
    agentId: canAssign ? (str(fd, "agentId") ?? fallbackAgent) : fallbackAgent,
    goalType: str(fd, "goalType"),
    targetAmount: numStr(fd, "targetAmount"),
    startDate: dateStr(fd, "startDate"),
    targetDate: dateStr(fd, "targetDate"),
    status: enumStr(fd, "status", goalStatus.enumValues) ?? "Planned",
    remark: str(fd, "remark"),
    recap: enumStr(fd, "recap", recap.enumValues),
    whatHappened: str(fd, "whatHappened"),
    why: str(fd, "why"),
    improvementPlan: str(fd, "improvementPlan"),
  };
}

export async function createGoal(fd: FormData) {
  const viewer = await getViewer();
  const values = parseGoalForm(fd, viewer.perms.goals === "all", viewer.userId);

  await getDb().insert(goals).values(values);

  revalidatePath("/goals");
  redirect("/goals");
}

export async function updateGoal(id: string, fd: FormData) {
  const viewer = await getViewer();
  const values = parseGoalForm(fd, viewer.perms.goals === "all", viewer.userId);

  // Own-scope viewers must not reassign a goal away from themselves; the
  // parse above already pins agentId to the viewer for them.
  await getDb()
    .update(goals)
    .set(values)
    .where(and(eq(goals.id, id), goalScope(viewer)));

  revalidatePath("/goals");
  redirect("/goals");
}
