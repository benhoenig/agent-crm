// /leave repository. Leave is personal data with an approval workflow:
// everyone sees their own rows; roles with perms.leaveApprove see the queue.
// Day counts are inclusive calendar days (end - start + 1) — the business
// tracked whole days in the sheet era; half-days can come later via the
// numeric allowance columns without schema change.

import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { leaveAllowances, leaves, users } from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { bkkToday } from "@/lib/format";

export const leaveDays = sql<number>`(${leaves.endDate} - ${leaves.startDate} + 1)`.mapWith(Number);

/** The viewer's balance for `year`: allowance (may be null) + approved days used, per type. */
export async function getLeaveBalance(userId: string, year: number) {
  const db = getDb();
  const [[allowance], used] = await Promise.all([
    db
      .select()
      .from(leaveAllowances)
      .where(
        and(eq(leaveAllowances.userId, userId), eq(leaveAllowances.year, year))
      )
      .limit(1),
    db
      .select({
        type: leaves.type,
        // Count only the days that FALL INSIDE `year`: a New-Year leave
        // (31 Dec → 2 Jan) is common here, and charging all of it to the
        // start year would silently overdraw one year's allowance and
        // under-report the next.
        days: sql<number>`coalesce(sum(
          greatest(
            0,
            least(${leaves.endDate}, ${`${year}-12-31`}::date)
              - greatest(${leaves.startDate}, ${`${year}-01-01`}::date)
              + 1
          )
        ), 0)`.mapWith(Number),
      })
      .from(leaves)
      .where(
        and(
          eq(leaves.userId, userId),
          eq(leaves.status, "approved"),
          // overlap, not "starts in this year"
          lte(leaves.startDate, `${year}-12-31`),
          gte(leaves.endDate, `${year}-01-01`)
        )
      )
      .groupBy(leaves.type),
  ]);

  const usedByType = new Map(used.map((u) => [u.type as string, u.days]));
  return {
    allowance: allowance ?? null,
    used: {
      sick: usedByType.get("sick") ?? 0,
      personal: usedByType.get("personal") ?? 0,
      vacation: usedByType.get("vacation") ?? 0,
      other: usedByType.get("other") ?? 0,
    },
  };
}

export async function listMyLeaves(viewer: Viewer, limit = 30) {
  return getDb()
    .select({
      id: leaves.id,
      startDate: leaves.startDate,
      endDate: leaves.endDate,
      days: leaveDays,
      type: leaves.type,
      status: leaves.status,
      remark: leaves.remark,
      createdAt: leaves.createdAt,
    })
    .from(leaves)
    .where(eq(leaves.userId, viewer.userId))
    .orderBy(desc(leaves.startDate))
    .limit(limit);
}

/** Pending queue for approvers, oldest request first. */
export async function listPendingLeaves() {
  return getDb()
    .select({
      id: leaves.id,
      userId: leaves.userId,
      userName: users.name,
      nickname: users.nickname,
      startDate: leaves.startDate,
      endDate: leaves.endDate,
      days: leaveDays,
      type: leaves.type,
      remark: leaves.remark,
      createdAt: leaves.createdAt,
    })
    .from(leaves)
    .innerJoin(users, eq(leaves.userId, users.id))
    .where(eq(leaves.status, "pending"))
    .orderBy(asc(leaves.createdAt));
}

/** Recently decided requests (approver history view). */
export async function listDecidedLeaves(limit = 20) {
  const approver = alias(users, "approver");
  return getDb()
    .select({
      id: leaves.id,
      userName: users.name,
      nickname: users.nickname,
      startDate: leaves.startDate,
      endDate: leaves.endDate,
      days: leaveDays,
      type: leaves.type,
      status: leaves.status,
      approverName: approver.name,
      remark: leaves.remark,
    })
    .from(leaves)
    .innerJoin(users, eq(leaves.userId, users.id))
    .leftJoin(approver, eq(leaves.approvedBy, approver.id))
    .where(inArray(leaves.status, ["approved", "rejected"]))
    .orderBy(desc(leaves.updatedAt))
    .limit(limit);
}

/** Everyone on approved leave today (small team — no pagination needed). */
export async function listOnLeaveToday() {
  const today = bkkToday();
  return getDb()
    .select({
      userId: leaves.userId,
      userName: users.name,
      nickname: users.nickname,
      type: leaves.type,
      endDate: leaves.endDate,
    })
    .from(leaves)
    .innerJoin(users, eq(leaves.userId, users.id))
    .where(
      and(
        eq(leaves.status, "approved"),
        lte(leaves.startDate, today),
        gte(leaves.endDate, today)
      )
    );
}

/** Is this user on approved leave today? (LINE plan card.) */
export async function isOnLeaveToday(userId: string): Promise<boolean> {
  const today = bkkToday();
  const [row] = await getDb()
    .select({ n: count() })
    .from(leaves)
    .where(
      and(
        eq(leaves.userId, userId),
        eq(leaves.status, "approved"),
        lte(leaves.startDate, today),
        gte(leaves.endDate, today)
      )
    );
  return row.n > 0;
}
