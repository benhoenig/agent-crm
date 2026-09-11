// /goals repository. Goals are personal targets; perms.goals decides whether
// the viewer sees only their own or the whole board. Progress ("actual") is
// the agent's summed deal commission inside the goal's date window — computed
// in SQL so the board and the dashboard ring can never disagree on source.

import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { goals, goalStatus, users } from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";

const PAGE_SIZE = 24;

/**
 * THE definition of goal progress (Ben, 2026-08-17): commission the goal's
 * agent closed INSIDE the goal's own [startDate, targetDate] window. Every
 * surface — the board, the dashboard ring, the LINE /plan card — reads this
 * one expression, so a goal can never show two different percentages.
 * A null bound is treated as open-ended on that side.
 */
const actualCommission = sql<string>`(
  select coalesce(sum(d.commission), 0)
  from deals d
  where d.sales_id = ${goals.agentId}
    and (${goals.startDate} is null or d.closing_date >= ${goals.startDate})
    and (${goals.targetDate} is null or d.closing_date <= ${goals.targetDate})
)`;

export function goalScope(viewer: Viewer): SQL | undefined {
  return viewer.perms.goals === "all"
    ? undefined
    : eq(goals.agentId, viewer.userId);
}

export interface GoalFilters {
  agentId?: string;
  status?: string;
  page?: number;
}

export async function listGoals(viewer: Viewer, filters: GoalFilters = {}) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);

  const where = and(
    goalScope(viewer),
    filters.agentId ? eq(goals.agentId, filters.agentId) : undefined,
    filters.status &&
      (goalStatus.enumValues as readonly string[]).includes(filters.status)
      ? eq(goals.status, filters.status as (typeof goalStatus.enumValues)[number])
      : undefined
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: goals.id,
        name: goals.name,
        agentId: goals.agentId,
        agentName: users.name,
        agentNickname: users.nickname,
        goalType: goals.goalType,
        targetAmount: goals.targetAmount,
        startDate: goals.startDate,
        targetDate: goals.targetDate,
        status: goals.status,
        remark: goals.remark,
        recap: goals.recap,
        actual: actualCommission,
      })
      .from(goals)
      .leftJoin(users, eq(goals.agentId, users.id))
      .where(where)
      .orderBy(
        // Working goals first, then upcoming, then the closed ones.
        sql`case ${goals.status}
          when 'In Progress' then 0
          when 'Planned' then 1
          else 2 end`,
        desc(goals.targetDate)
      )
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(goals).where(where),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getGoal(viewer: Viewer, id: string) {
  const [row] = await getDb()
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), goalScope(viewer)))
    .limit(1);
  return row ?? null;
}

/** Agent options for the board filter / assignment select (managers). */
export async function getAgentOptions() {
  return getDb()
    .select({ id: users.id, name: users.name, nickname: users.nickname })
    .from(users)
    .where(eq(users.banned, false))
    .orderBy(users.name);
}

/**
 * The one goal to headline on the dashboard ring and the LINE /plan card:
 * the agent's "In Progress" goal whose window covers today, most recently
 * started if several overlap. Returns null when they have no such goal —
 * which is NOT the same as a goal at 0%, so callers hide the ring entirely.
 *
 * Deliberately a single goal, not a sum: adding up targets with different
 * deadlines produces a percentage that tells you nothing about which goal is
 * at risk.
 */
export async function getCurrentGoal(userId: string) {
  const today = sql`(now() at time zone 'Asia/Bangkok')::date`;
  const [row] = await getDb()
    .select({
      id: goals.id,
      name: goals.name,
      targetAmount: goals.targetAmount,
      startDate: goals.startDate,
      targetDate: goals.targetDate,
      actual: actualCommission,
    })
    .from(goals)
    .where(
      and(
        eq(goals.agentId, userId),
        eq(goals.status, "In Progress"),
        sql`(${goals.startDate} is null or ${goals.startDate} <= ${today})`,
        sql`(${goals.targetDate} is null or ${goals.targetDate} >= ${today})`
      )
    )
    .orderBy(desc(goals.startDate))
    .limit(1);

  if (!row) return null;

  const target = row.targetAmount ? Number(row.targetAmount) : 0;
  const actual = Number(row.actual);
  return {
    ...row,
    actual,
    target,
    /** null when the goal carries no amount — a progress bar would be a lie. */
    pct: target > 0 ? Math.round((actual / target) * 100) : null,
  };
}
