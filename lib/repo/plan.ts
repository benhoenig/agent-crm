// Reading one person's planner — ported from the Klaichan/Mook CRM.
//
// ONE FETCH, NOT ONE PER DAY. The card walks backwards and forwards through
// days, and the streak, the calendar heat and the personal best all need
// history — so paging per day would mean a round trip on every ◀ tap. The
// whole plan is small by nature (one person's tasks) and bounded below.
//
// Scoped to the signed-in user everywhere. A plan is personal work; there is
// no "see everyone's plan" view and no permission that grants one.
//
// DAY-OFFS ARE A UNION: the planner's own วันหยุด markers (plan_dayoffs)
// plus formal approved leave (leaves) — a granted ลาพักร้อน must bridge the
// streak without being marked twice.

import { and, eq, gte, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  dailyPlanTasks,
  leaves,
  planDayoffs,
  planPrefs,
  planRecaps,
  planRecurring,
} from "@/lib/db/schema";
import { bkkToday } from "@/lib/format";
import {
  addDays,
  normalizeFreq,
  type PlanData,
  type PlanPrefs,
  type PlanTask,
  type RecurRule,
} from "@/lib/plan";

/** How far back the planner loads. A year covers the streak, the personal
    best and any calendar month worth looking at, and caps the payload at
    something a phone can hold. */
const HISTORY_DAYS = 365;

export async function getPlan(userId: string): Promise<PlanData> {
  const db = getDb();
  const today = bkkToday();
  const since = addDays(today, -HISTORY_DAYS);

  const [taskRows, ruleRows, offRows, leaveRows, recapRows, prefRow] =
    await Promise.all([
      db
        .select()
        .from(dailyPlanTasks)
        .where(
          and(
            eq(dailyPlanTasks.userId, userId),
            // Backlog items have no date and must never be filtered out by one.
            or(isNull(dailyPlanTasks.date), gte(dailyPlanTasks.date, since))
          )
        ),
      db.select().from(planRecurring).where(eq(planRecurring.userId, userId)),
      db
        .select({ date: planDayoffs.date })
        .from(planDayoffs)
        .where(and(eq(planDayoffs.userId, userId), gte(planDayoffs.date, since))),
      db
        .select({ start: leaves.startDate, end: leaves.endDate })
        .from(leaves)
        .where(
          and(
            eq(leaves.userId, userId),
            eq(leaves.status, "approved"),
            gte(leaves.endDate, since)
          )
        ),
      db
        .select()
        .from(planRecaps)
        .where(and(eq(planRecaps.userId, userId), gte(planRecaps.date, since))),
      db
        .select({ prefs: planPrefs.prefs })
        .from(planPrefs)
        .where(eq(planPrefs.userId, userId))
        .limit(1),
    ]);

  // Expand approved leave ranges into dates (bounded to the window + a year
  // ahead so a long-booked vacation shows on the calendar).
  const dayoffSet = new Set(offRows.map((r) => r.date));
  const horizon = addDays(today, 366);
  for (const l of leaveRows) {
    let d = l.start < since ? since : l.start;
    const end = l.end > horizon ? horizon : l.end;
    while (d <= end) {
      dayoffSet.add(d);
      d = addDays(d, 1);
    }
  }

  return {
    tasks: taskRows.map(toTask),
    recurring: ruleRows.map(toRule),
    dayoffs: [...dayoffSet],
    recaps: recapRows.map((r) => ({
      date: r.date,
      good: r.good ?? "",
      lesson: r.lesson ?? "",
      tomorrow: r.tomorrow ?? "",
    })),
    prefs: toPrefs(prefRow[0]?.prefs),
  };
}

export function toTask(r: typeof dailyPlanTasks.$inferSelect): PlanTask {
  return {
    id: r.id,
    date: r.date,
    title: r.title,
    done: r.done,
    sortOrder: r.sortOrder,
    kind: r.kind,
    actionCategory: r.actionCategory,
    targetQuantity: r.targetQuantity,
    notes: r.notes,
    recurringId: r.recurringId,
    startTime: r.startTime,
    endTime: r.endTime,
    leadId: r.leadId,
    listingId: r.listingId,
  };
}

export function toRule(r: typeof planRecurring.$inferSelect): RecurRule {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes,
    kind: r.kind,
    actionCategory: r.actionCategory,
    targetQuantity: r.targetQuantity,
    freq: normalizeFreq(r.freq),
    weekdays: r.weekdays,
    dayOfMonth: r.dayOfMonth,
    startDate: r.startDate,
    startTime: r.startTime,
    endTime: r.endTime,
    active: r.active,
  };
}

/** Coerce whatever is in the JSONB bag into the shape the planner expects.
    Sanitising here means one bad write can't crash the card: weekdays are
    clamped to 0–6, past skip dates are dropped (the auto-mark is
    forward-only, so they are dead). */
function toPrefs(raw: unknown): PlanPrefs {
  const p = (raw ?? {}) as Record<string, unknown>;
  const today = bkkToday();
  const offDays = Array.isArray(p.offDays)
    ? [
        ...new Set(
          p.offDays
            .map(Number)
            .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        ),
      ]
    : [];
  const offDaysSkip = Array.isArray(p.offDaysSkip)
    ? p.offDaysSkip.filter(
        (d): d is string => typeof d === "string" && d >= today
      )
    : [];
  return { offDays, offDaysSkip };
}
