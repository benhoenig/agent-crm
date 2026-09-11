import "server-only";

/* ภาพรวมทีม — the aggregates behind the manager/admin/support dashboard.

   PORTED FROM the Habihub Sales Dashboard's Overview tab (Ben, 2026-08-28),
   which is the screen the leadership team already reads. Its seven components
   replace the four stat tiles, the goal ring, the recent-listings table and
   the flat leaderboard that stood here — those answered "what happened to a
   few rows", and none of them answered "how is the team doing this month",
   which is the only question this page is opened for.

   ONE STRUCTURAL DIFFERENCE FROM THE SOURCE. The Sales Dashboard reads flat
   `summary_*` sheets built by a nightly script; every figure is precomputed
   and every tab is a lookup. Here the source tables ARE the source, so each
   card is a real aggregate over deals / leads / listings / actions. That is
   why the metric registry (lib/team-metrics.ts) is code plus picklist rather
   than a fixed column list: it has to survive someone adding an action
   category in Settings.

   SCOPING. The team cards are deliberately team-wide, the same call the old
   leaderboard made and for the same reason: they are aggregates with no PII,
   and a "team overview" filtered to the reader's own rows is not one. The
   revenue-bearing cards are instead gated at the PAGE on `perms.deals`, so
   listing support — who may not see deals at all — is shown the activity
   half of the dashboard and none of the money. */

import { and, asc, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  actions,
  agentTargets,
  deals,
  leads,
  listings,
  options,
  userRoles,
  users,
} from "@/lib/db/schema";
import { countable, notVoided } from "./activities";
import type { Viewer } from "@/lib/auth/session";
import { dealScope, leadScope, listingScope } from "./scope";
import {
  monthEndExclusive,
  monthStart,
  monthsBetween,
  previousRange,
  type MonthRange,
} from "@/lib/month-range";
import { ACTION_METRIC_PREFIX, actionMetric } from "@/lib/team-metrics";
import { kindMetric, REVENUE_METRIC } from "@/lib/targets";

/** Half-open [start, next) bounds for a month range. Half-open everywhere so
    a deal closed on the 31st is never dropped by a `<=` that assumed 30. */
function bounds(range: MonthRange) {
  return { start: monthStart(range.from), next: monthEndExclusive(range.to) };
}

const BKK = (col: unknown) =>
  sql`(${col} at time zone 'Asia/Bangkok')::date`;

/* ── the team ─────────────────────────────────────────────────────────── */

export interface TeamMember {
  id: string;
  name: string;
  image: string | null;
}

/**
 * The sales roster every per-agent card is indexed by.
 *
 * Membership comes from `user_roles`, NOT from `users.role`: Do and Stang are
 * manager AND sales, and their primary role is the manager one, so the
 * primary column would leave the two biggest producers out of every column on
 * this page. Banned users are excluded — a departed agent is not a row anyone
 * is comparing themselves against — with the deliberate consequence that work
 * they logged before leaving is absent from the per-agent cards while still
 * counting in the team totals.
 */
export async function getSalesTeam(): Promise<TeamMember[]> {
  return getDb()
    .select({ id: users.id, name: users.name, image: users.image })
    .from(users)
    .innerJoin(
      userRoles,
      and(eq(userRoles.userId, users.id), eq(userRoles.roleId, "sales"))
    )
    .where(eq(users.banned, false))
    .orderBy(asc(users.name));
}

/* ── 1. hero: team revenue vs target ──────────────────────────────────── */

export interface TeamRevenue {
  total: number;
  deals: number;
  /** The equal-length span immediately before — the delta's denominator. */
  prevTotal: number;
}

export async function getTeamRevenue(
  viewer: Viewer,
  range: MonthRange
): Promise<TeamRevenue> {
  const db = getDb();
  const now = bounds(range);
  const before = bounds(previousRange(range));
  const scope = dealScope(viewer);

  const sum = (from: string, to: string) =>
    db
      .select({
        total: sql<number>`coalesce(sum(${deals.commission}), 0)::float8`,
        n: count(),
      })
      .from(deals)
      .where(
        and(scope, gte(deals.closingDate, from), lt(deals.closingDate, to))
      );

  const [[cur], [prev]] = await Promise.all([
    sum(now.start, now.next),
    sum(before.start, before.next),
  ]);

  return { total: cur.total, deals: cur.n, prevTotal: prev.total };
}

export interface RevenueTargetRow extends TeamMember {
  /** The agent's STANDING monthly commission target, or null if unset. */
  monthly: number | null;
}

/**
 * Every sales agent's monthly revenue target — the hero's goal bar, and the
 * rows its editor writes back.
 *
 * The TEAM target is the sum of these times the number of months selected
 * (see lib/targets.ts REVENUE_METRIC for why it is a sum rather than its own
 * row). Agents with no target contribute nothing, so a partly-set team gives
 * a goal bar that understates rather than one that guesses.
 */
export async function getRevenueTargets(): Promise<RevenueTargetRow[]> {
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      monthly: agentTargets.amount,
    })
    .from(users)
    .innerJoin(
      userRoles,
      and(eq(userRoles.userId, users.id), eq(userRoles.roleId, "sales"))
    )
    .leftJoin(
      agentTargets,
      and(
        eq(agentTargets.agentId, users.id),
        eq(agentTargets.metric, REVENUE_METRIC),
        eq(agentTargets.period, "month"),
        eq(agentTargets.periodKey, "")
      )
    )
    .where(eq(users.banned, false))
    .orderBy(asc(users.name));
}

/* ── 2. leaderboard ───────────────────────────────────────────────────── */

export interface LeaderRow extends TeamMember {
  total: number;
  deals: number;
}

/** Closed commission per agent over the selected range. Team-wide by design
    — an aggregate with no PII, exactly as the card it replaces was. */
export async function getRevenueLeaderboard(
  range: MonthRange
): Promise<LeaderRow[]> {
  const { start, next } = bounds(range);
  const rows = await getDb()
    .select({
      id: deals.salesId,
      name: users.name,
      image: users.image,
      total: sql<number>`coalesce(sum(${deals.commission}), 0)::float8`,
      deals: count(),
    })
    .from(deals)
    .innerJoin(users, eq(deals.salesId, users.id))
    .where(and(gte(deals.closingDate, start), lt(deals.closingDate, next)))
    .groupBy(deals.salesId, users.name, users.image)
    .orderBy(sql`coalesce(sum(${deals.commission}), 0) desc`);
  return rows as LeaderRow[];
}

/* ── 3. annual trend ──────────────────────────────────────────────────── */

export interface TeamTrend {
  /** Jan–Dec of `year`, as "YYYY-MM". */
  months: string[];
  /** metric key → one value per month, zero-filled. */
  series: Record<string, number[]>;
  /** The action categories that earned a series, in picklist order. */
  categories: string[];
}

/**
 * Twelve months of every plottable metric, in one shot.
 *
 * ALL METRICS ARE FETCHED, not just the selected one, and the toggle is
 * client-side. Four grouped aggregates over a year is a cheap query; a round
 * trip per pill press is a spinner on every glance. The chart is also
 * deliberately NOT driven by the month-range picker — a trend needs a span
 * longer than the thing being filtered, and "เดือนนี้" would collapse it to a
 * single point. RevenueTrendCard on the sales dashboard says the same.
 */
export async function getTeamTrend(
  viewer: Viewer,
  year: number
): Promise<TeamTrend> {
  const db = getDb();
  const start = `${year}-01-01`;
  const next = `${year + 1}-01-01`;
  const months = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`
  );

  const LISTED = sql`coalesce(${listings.listedAt}, ${BKK(listings.createdAt)})`;

  const [dealRows, leadRows, listingRows, actionRows, categoryRows] =
    await Promise.all([
      db
        .select({
          month: sql<string>`to_char(${deals.closingDate}, 'YYYY-MM')`,
          total: sql<number>`coalesce(sum(${deals.commission}), 0)::float8`,
          n: count(),
        })
        .from(deals)
        .where(
          and(
            dealScope(viewer),
            gte(deals.closingDate, start),
            lt(deals.closingDate, next)
          )
        )
        .groupBy(sql`1`),

      db
        .select({
          month: sql<string>`to_char(${BKK(leads.createdAt)}, 'YYYY-MM')`,
          n: count(),
        })
        .from(leads)
        .where(
          and(
            leadScope(viewer),
            sql`${BKK(leads.createdAt)} >= ${start}::date`,
            sql`${BKK(leads.createdAt)} < ${next}::date`
          )
        )
        .groupBy(sql`1`),

      db
        .select({
          month: sql<string>`to_char(${LISTED}, 'YYYY-MM')`,
          n: count(),
        })
        .from(listings)
        .where(
          and(
            listingScope(viewer),
            sql`${LISTED} >= ${start}::date`,
            sql`${LISTED} < ${next}::date`
          )
        )
        .groupBy(sql`1`),

      db
        .select({
          month: sql<string>`to_char(${actions.date}, 'YYYY-MM')`,
          category: sql<string>`${actions.category}`,
          n: count(),
        })
        .from(actions)
        .where(and(gte(actions.date, start), lt(actions.date, next), countable))
        .groupBy(sql`1`, actions.category),

      // The picklist decides which categories get a series AND their order,
      // so a category added in Settings appears here with no code change.
      db
        .select({ key: options.key })
        .from(options)
        .where(
          and(eq(options.kind, "action_category"), eq(options.archived, false))
        )
        .orderBy(asc(options.sortOrder), asc(options.key)),
    ]);

  const categories = categoryRows.map((r) => r.key);
  const blank = () => new Array(12).fill(0) as number[];
  const series: Record<string, number[]> = {
    revenue: blank(),
    closed_deals: blank(),
    new_leads: blank(),
    new_listings: blank(),
    actions_total: blank(),
  };
  for (const c of categories) series[actionMetric(c)] = blank();

  // to_char can only produce a month inside the queried year, so the index is
  // always 0–11; the guard is for a category that was archived between the
  // two queries above rather than for a bad month.
  const at = (month: string) => Number(month.slice(5, 7)) - 1;

  for (const r of dealRows) {
    series.revenue[at(r.month)] = r.total;
    series.closed_deals[at(r.month)] = r.n;
  }
  for (const r of leadRows) series.new_leads[at(r.month)] = r.n;
  for (const r of listingRows) series.new_listings[at(r.month)] = r.n;
  for (const r of actionRows) {
    series.actions_total[at(r.month)] += r.n;
    const key = ACTION_METRIC_PREFIX + r.category;
    if (series[key]) series[key][at(r.month)] += r.n;
  }

  return { months, series, categories };
}

/* ── 4. KPI tracker ───────────────────────────────────────────────────── */

export interface TeamKpi {
  /** Owner-side action categories, in picklist order — one column each. */
  categories: string[];
  /** category → agentId → actions logged in the range. */
  counts: Record<string, Record<string, number>>;
  /** category → agentId → the target for THIS range (monthly × months). */
  targets: Record<string, Record<string, number>>;
}

/**
 * ผลงานตามกระบวนการขาย — every agent scored against their own target, one
 * column per acquisition activity.
 *
 * THE COLUMNS COME FROM `options.scope = 'owner'` (migration 0018), not from
 * a list in this file. The Sales Dashboard hardcodes six KPI ids against six
 * sheet columns; here the owner side of the business is already a property of
 * the picklist, and reusing it means this card and ความเคลื่อนไหว can never
 * disagree about what counts as acquisition work.
 *
 * Buyer-side categories are deliberately absent: they are already the subject
 * of the funnel, and repeating them here would score the same work twice
 * under two different denominators.
 */
export async function getTeamKpi(range: MonthRange): Promise<TeamKpi> {
  const db = getDb();
  const { start, next } = bounds(range);
  const span = monthsBetween(range.from, range.to).length;

  const [categoryRows, countRows, targetRows] = await Promise.all([
    db
      .select({ key: options.key })
      .from(options)
      .where(
        and(
          eq(options.kind, "action_category"),
          eq(options.scope, "owner"),
          eq(options.archived, false)
        )
      )
      .orderBy(asc(options.sortOrder), asc(options.key)),

    db
      .select({
        category: sql<string>`${actions.category}`,
        agentId: actions.agentId,
        n: count(),
      })
      .from(actions)
      .innerJoin(
        options,
        and(
          eq(options.kind, "action_category"),
          eq(options.key, actions.category),
          eq(options.scope, "owner")
        )
      )
      .where(and(gte(actions.date, start), lt(actions.date, next), notVoided))
      .groupBy(actions.category, actions.agentId),

    // Standing monthly targets only. A per-period override (period_key
    // '2026-08') cannot be scaled across a multi-month range without picking
    // one month's exception and applying it to all of them, so the range card
    // reads the standing figure and the per-agent card (ความเคลื่อนไหว) keeps
    // the override.
    db
      .select({
        agentId: agentTargets.agentId,
        metric: agentTargets.metric,
        amount: agentTargets.amount,
      })
      .from(agentTargets)
      .where(
        and(eq(agentTargets.period, "month"), eq(agentTargets.periodKey, ""))
      ),
  ]);

  const categories = categoryRows.map((r) => r.key);
  const counts: Record<string, Record<string, number>> = {};
  const targets: Record<string, Record<string, number>> = {};
  for (const c of categories) {
    counts[c] = {};
    targets[c] = {};
  }

  for (const r of countRows) counts[r.category]![r.agentId] = r.n;

  const byMetric = new Map(categories.map((c) => [kindMetric(c), c]));
  for (const r of targetRows) {
    const category = byMetric.get(r.metric);
    if (category) targets[category]![r.agentId] = r.amount * span;
  }

  return { categories, counts, targets };
}

/* ── 5. daily heatmap ─────────────────────────────────────────────────── */

export interface HeatCell {
  day: number;
  agentId: string;
  /** 'owner' | 'buyer' | 'other' — options.scope, with NULL named. */
  scope: string;
  n: number;
}

/**
 * One calendar month of actions, day × agent × side.
 *
 * Returned as flat cells and pivoted in the browser: at most 31 × the roster
 * × 3, which is a few hundred rows, and doing it here would fix the category
 * filter server-side and cost a round trip every time someone flips it.
 *
 * Shows the END month of the selected range — a heatmap of a six-month span
 * has no rows to be, and the last month is the one being asked about.
 */
export async function getActivityHeatmap(
  monthKey: string,
  team: TeamMember[]
): Promise<HeatCell[]> {
  if (team.length === 0) return [];
  const rows = await getDb()
    .select({
      day: sql<number>`extract(day from ${actions.date})::int`,
      agentId: actions.agentId,
      scope: sql<string>`coalesce(${options.scope}, 'other')`,
      n: count(),
    })
    .from(actions)
    .leftJoin(
      options,
      and(
        eq(options.kind, "action_category"),
        eq(options.key, actions.category)
      )
    )
    .where(
      and(
        gte(actions.date, monthStart(monthKey)),
        lt(actions.date, monthEndExclusive(monthKey)),
        countable,
        inArray(
          actions.agentId,
          team.map((m) => m.id)
        )
      )
    )
    .groupBy(sql`1`, actions.agentId, sql`3`);
  return rows as HeatCell[];
}

/* ── 6. activity matrix ───────────────────────────────────────────────── */

export interface MatrixCategory {
  key: string;
  /** 'owner' | 'buyer' | 'other' — drives the grouped column header. */
  scope: string;
}

export interface ActivityMatrix {
  categories: MatrixCategory[];
  /** agentId → category → count. */
  counts: Record<string, Record<string, number>>;
}

/**
 * Every logged activity type × every agent, over the selected range.
 *
 * Where the KPI card asks "is each agent hitting their acquisition target",
 * this asks the flatter question the KPI card cannot: what is the shape of
 * each person's week. A column with a number for everyone except one agent is
 * the thing worth seeing, and it has no target to be measured against.
 *
 * ALL categories appear, including the scope-NULL ones (โอนกรรมสิทธิ์,
 * ประชุม, …) that both funnels exclude. They are excluded there because
 * guessing them into a funnel would inflate a number someone is measured on;
 * here nothing is being measured, so leaving them out would just hide work.
 */
export async function getActivityMatrix(
  range: MonthRange,
  team: TeamMember[]
): Promise<ActivityMatrix> {
  const db = getDb();
  const { start, next } = bounds(range);

  const [categoryRows, countRows] = await Promise.all([
    db
      .select({ key: options.key, scope: options.scope })
      .from(options)
      .where(
        and(eq(options.kind, "action_category"), eq(options.archived, false))
      )
      .orderBy(asc(options.sortOrder), asc(options.key)),
    team.length === 0
      ? Promise.resolve([])
      : db
          .select({
            agentId: actions.agentId,
            category: sql<string>`${actions.category}`,
            n: count(),
          })
          .from(actions)
          .where(
            and(
              gte(actions.date, start),
              lt(actions.date, next),
              countable,
              inArray(
                actions.agentId,
                team.map((m) => m.id)
              )
            )
          )
          .groupBy(actions.agentId, actions.category),
  ]);

  // owner → buyer → other, so the table reads in the order the business
  // happens: you sign up a unit before you have anyone to show it to.
  const ORDER: Record<string, number> = { owner: 0, buyer: 1, other: 2 };
  const categories = categoryRows
    .map((r) => ({ key: r.key, scope: r.scope ?? "other" }))
    .sort((a, b) => ORDER[a.scope]! - ORDER[b.scope]!);

  const counts: Record<string, Record<string, number>> = {};
  for (const m of team) counts[m.id] = {};
  for (const r of countRows) {
    // An action can name a category that was archived after it was logged;
    // it still belongs to the agent's total, so it is kept in `counts` even
    // though no column will render it.
    (counts[r.agentId] ??= {})[r.category] = r.n;
  }

  return { categories, counts };
}
