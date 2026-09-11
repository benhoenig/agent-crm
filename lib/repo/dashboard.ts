// Dashboard repository — aggregates behind "/" (ภาพรวม). Every read is scoped
// by the viewer except the leaderboard (see note there). "Current month" and
// "this year" are Asia/Bangkok calendar ranges; in SQL, "today" is always
// (now() at time zone 'Asia/Bangkok')::date.

import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  deals,
  leads,
  listings,
  slaRules,
  userRoles,
  users,
  zones,
} from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { dealScope, leadScope, listingScope } from "./scope";
import { outstandingCommission } from "./deals";
import { PIPELINE_STAGES } from "@/lib/labels";
import { hasRole } from "./options";
import { bkkToday } from "@/lib/format";
import { ACTIVE_LISTING_ROLES } from "@/lib/options/kinds";

/** Current Asia/Bangkok month as [start, next-month-start) date strings. */
function bkkMonthRange(): { start: string; next: string } {
  const [y, m] = bkkToday().split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, next };
}

/** Current Asia/Bangkok year as [Jan 1, next Jan 1) date strings. */
function bkkYearRange(): { start: string; next: string } {
  const y = Number(bkkToday().slice(0, 4));
  return { start: `${y}-01-01`, next: `${y + 1}-01-01` };
}

const BKK_TODAY = sql`(now() at time zone 'Asia/Bangkok')::date`;

export async function getDashboardKpis(viewer: Viewer) {
  const db = getDb();
  const { start, next } = bkkMonthRange();
  const dScope = dealScope(viewer);
  const lScope = listingScope(viewer);

  const [[month], [pending], [newLeads], [active], [overdue]] =
    await Promise.all([
      // รายได้ (คอมมิชชัน) เดือนนี้ — deals closed inside the BKK month.
      db
        .select({
          total: sql<string>`coalesce(sum(${deals.commission}), 0)`,
        })
        .from(deals)
        .where(
          and(
            dScope,
            gte(deals.closingDate, start),
            lt(deals.closingDate, next)
          )
        ),
      // คอมมิชชันค้างจ่าย — shares /deals' definition (null status counts).
      db
        .select({
          total: sql<string>`coalesce(sum(${deals.commission}), 0)`,
          n: count(),
        })
        .from(deals)
        .where(and(dScope, outstandingCommission)),
      // Lead ใหม่เดือนนี้ — created inside the BKK month.
      db
        .select({ n: count() })
        .from(leads)
        .where(
          and(
            leadScope(viewer),
            sql`(${leads.createdAt} at time zone 'Asia/Bangkok')::date >= ${start}::date`,
            sql`(${leads.createdAt} at time zone 'Asia/Bangkok')::date < ${next}::date`
          )
        ),
      // ทรัพย์ Active — working inventory.
      db
        .select({ n: count() })
        .from(listings)
        .where(and(lScope, hasRole(listings.status, "listing_status", ACTIVE_LISTING_ROLES))),
      // …of which past the follow-up SLA (same join shape as lib/repo/today.ts).
      db
        .select({ n: count() })
        .from(listings)
        .innerJoin(
          slaRules,
          and(
            eq(slaRules.entity, "listing_follow"),
            sql`${slaRules.potential} = ${listings.potential}::text`
          )
        )
        .where(
          and(
            lScope,
            hasRole(listings.status, "listing_status", ACTIVE_LISTING_ROLES),
            sql`${BKK_TODAY} - coalesce(${listings.lastFollowedAt}, ${listings.listedAt}, (${listings.createdAt} at time zone 'Asia/Bangkok')::date) > ${slaRules.maxDays}`
          )
        ),
    ]);

  return {
    commissionThisMonth: month.total,
    pendingCommission: pending.total,
    pendingDeals: pending.n,
    newLeadsThisMonth: newLeads.n,
    activeListings: active.n,
    overdueListings: overdue.n,
  };
}

/** Active leads per pipeline stage, zero-filled across all 8 stages. */
export async function getPipelineCounts(viewer: Viewer) {
  const rows = await getDb()
    .select({ stage: leads.pipelineStage, n: count() })
    .from(leads)
    .where(and(hasRole(leads.leadStatus, "lead_status", "open"), leadScope(viewer)))
    .groupBy(leads.pipelineStage);

  const byStage = new Map(rows.map((r) => [r.stage as string, r.n]));
  return PIPELINE_STAGES.map((stage) => ({
    stage,
    n: byStage.get(stage) ?? 0,
  }));
}

/**
 * Open leads per agent — the assignment-balance card.
 *
 * Sits next to the waiting list because they are one decision: you cannot hand
 * out an enquiry well without seeing who is already buried. On dev this spread
 * is 194 open leads to 0, which nothing in the app showed before.
 *
 * Team-wide by design (like the leaderboard), and only rendered for
 * intakeAssign holders — the people whose job this is.
 */
export async function getLeadBalance() {
  // Unaliased on purpose: hasRole() emits "leads"."lead_status", so an alias
  // here would put the predicate out of reach of its own table.
  const rows = await getDb().execute(sql`
    select ${users.id} as id, ${users.name} as name,
      count(${leads.id}) filter (
        where ${hasRole(leads.leadStatus, "lead_status", "open")}
      )::int as open_leads
    from ${users}
    left join ${leads} on ${leads.assignedTo} = ${users.id}
    where ${users.banned} = false
      and exists (
        select 1 from ${userRoles} ur
        where ur.user_id = ${users.id} and ur.role_id = 'sales'
      )
    group by ${users.id}, ${users.name}
    order by open_leads desc, ${users.name}
  `);
  const active = rows.rows as unknown as {
    id: string;
    name: string;
    open_leads: number;
  }[];

  // Open leads held by someone whose login is suspended — work nobody is doing.
  // Found on dev: a departed agent still holding 36. The balance card is the
  // only place that would ever surface it, since they are (correctly) excluded
  // from the assignable list above.
  const stranded = await getDb().execute(sql`
    select count(*)::int as n
    from ${leads}
    join ${users} on ${users.id} = ${leads.assignedTo}
    where ${users.banned} = true
      and ${hasRole(leads.leadStatus, "lead_status", "open")}
  `);

  return {
    active,
    stranded: (stranded.rows[0] as unknown as { n: number }).n,
  };
}

/**
 * Monthly commission for the sales dashboard's แนวโน้มรายได้ chart.
 *
 * Keyed on `closing_date`, the SAME column goal progress uses
 * (lib/repo/goals.ts actualCommission) — a trend that counted transfer_date
 * would disagree with the target card sitting directly above it.
 *
 * Months with no deals must still appear, or the chart silently compresses a
 * quiet stretch into nothing; generate_series supplies the zeros.
 */
export async function getCommissionTrend(viewer: Viewer, months = 12) {
  const rows = await getDb().execute(sql`
    with span as (
      select generate_series(
        date_trunc('month', ${BKK_TODAY}::date) - make_interval(months => ${months - 1}),
        date_trunc('month', ${BKK_TODAY}::date),
        interval '1 month'
      )::date as month
    )
    select
      to_char(span.month, 'YYYY-MM') as month,
      coalesce(sum(${deals.commission}), 0)::float8 as total,
      count(${deals.id})::int as deal_count
    from span
    left join ${deals}
      on date_trunc('month', ${deals.closingDate}) = span.month
      -- unaliased on purpose: dealScope() emits "deals"."sales_id", so an
      -- alias here would put the scope out of reach of its own table
      and ${dealScope(viewer) ?? sql`true`}
    group by span.month
    order by span.month
  `);
  return rows.rows as unknown as {
    month: string;
    total: number;
    deal_count: number;
  }[];
}

/**
 * Goal progress moved to lib/repo/goals.ts `getCurrentGoal` — one definition
 * for the board, this ring and the LINE card (Ben, 2026-08-17). The old pair
 * here divided THIS MONTH's commission by the SUM of every active goal's
 * target, which disagreed with the board and went nonsensical with more than
 * one goal.
 */

/**
 * This year's commission per sales, top 8. Intentionally team-wide — the
 * leaderboard is an aggregate with no PII, so dealScope is NOT applied here.
 */
export async function getLeaderboard() {
  const { start, next } = bkkYearRange();
  return getDb()
    .select({
      salesId: deals.salesId,
      name: users.name,
      total: sql<string>`coalesce(sum(${deals.commission}), 0)`,
    })
    .from(deals)
    .innerJoin(users, eq(deals.salesId, users.id))
    .where(and(gte(deals.closingDate, start), lt(deals.closingDate, next)))
    .groupBy(deals.salesId, users.name)
    .orderBy(desc(sql`coalesce(sum(${deals.commission}), 0)`))
    .limit(8);
}

/** 5 most recently touched listings in the viewer's scope. */
export async function getRecentListings(viewer: Viewer, limit = 5) {
  return getDb()
    .select({
      id: listings.id,
      legacyCode: listings.legacyCode,
      listingName: listings.listingName,
      potential: listings.potential,
      status: listings.status,
      askingPrice: listings.askingPrice,
      rentalPrice: listings.rentalPrice,
      zoneName: zones.nameThai,
      zoneCode: zones.code,
    })
    .from(listings)
    .leftJoin(zones, eq(listings.zoneId, zones.id))
    .where(listingScope(viewer))
    .orderBy(desc(listings.updatedAt))
    .limit(limit);
}
