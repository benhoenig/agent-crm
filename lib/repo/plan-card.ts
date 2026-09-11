// Data assembly for the LINE /plan card. Reuses the SAME sources as the app:
// daily_plan_tasks (today, Asia/Bangkok), the dashboard ring's goal math, and
// approved leaves — the card can never disagree with the dashboard.

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dailyPlanTasks } from "@/lib/db/schema";
import { getCurrentGoal } from "./goals";
import { isOnLeaveToday } from "./leave";
import { bkkToday } from "@/lib/format";
import type { PlanTaskRow } from "@/lib/line/flex";

export async function getPlanCardData(userId: string): Promise<{
  tasks: PlanTaskRow[];
  goalPct: number | null;
  onLeave: boolean;
}> {
  const [tasks, goal, onLeave] = await Promise.all([
    getDb()
      .select({
        title: dailyPlanTasks.title,
        done: dailyPlanTasks.done,
        startTime: dailyPlanTasks.startTime,
      })
      .from(dailyPlanTasks)
      .where(
        and(
          eq(dailyPlanTasks.userId, userId),
          eq(dailyPlanTasks.date, bkkToday())
        )
      )
      .orderBy(asc(dailyPlanTasks.sortOrder), asc(dailyPlanTasks.createdAt)),
    getCurrentGoal(userId),
    isOnLeaveToday(userId),
  ]);

  return {
    // startTime is a pg `time` — "HH:MM:SS"; the card shows "HH:MM".
    tasks: tasks.map((t) => ({
      title: t.title,
      done: t.done,
      startTime: t.startTime ? t.startTime.slice(0, 5) : null,
    })),
    goalPct: goal?.pct ?? null,
    onLeave,
  };
}
