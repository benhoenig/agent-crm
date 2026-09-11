// /today repository — the agent's daily plan, ติดตามวันนี้, and โพสต์เก่า.
// Queue queries join sla_rules in SQL (same shape as the dashboard's overdue
// count) so every overdue number on every surface reads the one rules table.
// "Today" in SQL is always (now() at time zone 'Asia/Bangkok')::date.
//
// The two FOLLOW queues (ตามเจ้าของทรัพย์ + ตาม Lead) were separate tables
// until 2026-08-28; they are now one ranked call list — see getFollowUps().
// โพสต์เก่า stayed its own queue because it is a different verb: nobody is
// called, a portal listing is refreshed.

import { and, asc, count, desc, eq, isNotNull, sql, type Column } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  actions,
  contacts,
  dailyPlanTasks,
  leads,
  listings,
  slaRules,
} from "@/lib/db/schema";
import { countable } from "./activities";
import type { Viewer } from "@/lib/auth/session";
import { leadScope, listingScope } from "./scope";
import { hasRole } from "./options";
import { bkkToday } from "@/lib/format";
import { ACTIVE_LISTING_ROLES } from "@/lib/options/kinds";

const QUEUE_LIMIT = 15;

const BKK_TODAY = sql`(now() at time zone 'Asia/Bangkok')::date`;

/* ── แผนของฉัน — the viewer's own tasks for today ─────────────────── */


/* ── ติดตามวันนี้ — ONE ranked call list across leads and listings ───── */

/* PORTED FROM the Klaichan CRM follow-up card, 2026-08-28. The design is
   hers; the SQL is not, and the difference matters twice.

   NOTHING IS STORED. Overdue-ness is a comparison against today that stops
   being true the moment a follow-up lands, so there is no `is_overdue` column
   and no nightly job to set one. A row leaves this list because the record
   moved, not because anything was marked handled.

   TWO DIVERGENCES FROM KLAICHAN, both forced by this app:

   1. VIEWER SCOPING. Klaichan's version is one raw-SQL union with no scoping —
      Cream sees everything. Here a sales agent must see own+zone and nothing
      more, and that rule lives in lib/repo/scope.ts. Rewriting it inside a
      raw union would be a second copy of the one thing that must never drift,
      so each side is queried through the ordinary builder with its own
      scope helper and the two are interleaved in TypeScript below. Four small
      indexed queries, and one definition of who-sees-what.

   2. THE SLA SOURCE. Klaichan reads a window off the grade row in `options`;
      here it is the `sla_rules` table (entity + potential → max_days), which
      Ben edits at /settings/sla and which every other overdue number on every
      other surface already joins.

   RANKED BY DAYS PAST THE WINDOW, not days since contact: being 40 days late
   on a grade-A buyer with a 3-day window is worse than 40 days on a grade-D
   with a 30-day one, and the window is what says so. */

export const FOLLOWUP_LIMIT = 7;

export type FollowUpSide = "lead" | "listing";

export interface FollowUpRow {
  side: FollowUpSide;
  id: string;
  /** WHO to call — the lead's contact, or the listing's OWNER. */
  name: string;
  /** What the call is about: the unit. Null when there is none. */
  subtitle: string | null;
  /** Potential grade key, for the chip. */
  grade: string | null;
  /** Days since the reference date (last follow, else the record's arrival). */
  days: number;
  /** The SLA window this record is judged against (sla_rules.max_days). */
  window: number;
  /** Days PAST the window — the ranking key, always ≥ 1. */
  daysOver: number;
  /** Already on the VIEWER'S OWN plan and not yet ticked. */
  onPlan: boolean;
}

export interface FollowUps {
  rows: FollowUpRow[];
  /** Totals across everything overdue, not just the rows returned — the card
      states the cap it applied rather than implying rows.length is all of it. */
  totalLeads: number;
  totalListings: number;
}

/* ── SLA queue a: ตามเจ้าของทรัพย์เกิน SLA (listing_follow) ─────────── */

// Reference date: last follow, else the sheet listing date, else creation day.
const listingFollowRef = sql`coalesce(${listings.lastFollowedAt}, ${listings.listedAt}, (${listings.createdAt} at time zone 'Asia/Bangkok')::date)`;

/* ── SLA queue b: โพสต์เก่าเกิน SLA (listing_post) ───────────────────── */

export async function getListingPostQueue(viewer: Viewer) {
  const db = getDb();
  const daysOver = sql<number>`(${BKK_TODAY} - ${listings.postedAt}) - ${slaRules.maxDays}`.mapWith(Number);
  const joinOn = and(
    eq(slaRules.entity, "listing_post"),
    sql`${slaRules.potential} = ${listings.potential}::text`
  );
  const where = and(
    hasRole(listings.status, "listing_status", "posted"),
    isNotNull(listings.postedAt),
    sql`(${BKK_TODAY} - ${listings.postedAt}) > ${slaRules.maxDays}`,
    listingScope(viewer)
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: listings.id,
        listingName: listings.listingName,
        legacyCode: listings.legacyCode,
        potential: listings.potential,
        daysOver,
      })
      .from(listings)
      .innerJoin(slaRules, joinOn)
      .where(where)
      .orderBy(desc(daysOver))
      .limit(QUEUE_LIMIT),
    db
      .select({ total: count() })
      .from(listings)
      .innerJoin(slaRules, joinOn)
      .where(where),
  ]);

  return { rows, total };
}

/* ── ติดตามวันนี้ ─────────────────────────────────────────────────── */

// "New Lead" has no sla_rules row by design — the inner join drops it.
const leadFollowRef = sql`coalesce(${leads.lastFollowedAt}, (${leads.createdAt} at time zone 'Asia/Bangkok')::date)`;

/** EXISTS against the viewer's OWN open tasks.

    Klaichan treats a record as claimed if it sits on ANY plan, which is the
    same thing there — one user. Here it must be the viewer's own: two agents
    can share a zone, and a teammate's task is not a reason to hide work from
    your call list. A ticked task does NOT claim: that follow-up already
    happened, and if the record is still overdue it should be offered again. */
function onPlanFor(taskColumn: Column, recordId: Column, userId: string) {
  return sql<boolean>`exists (
    select 1 from ${dailyPlanTasks}
    where ${taskColumn} = ${recordId}
      and ${dailyPlanTasks.userId} = ${userId}::uuid
      and ${dailyPlanTasks.done} = false
  )`;
}

export async function getFollowUps(
  viewer: Viewer,
  limit = FOLLOWUP_LIMIT
): Promise<FollowUps> {
  const db = getDb();

  /* ---- owner side: ตามเจ้าของทรัพย์ ---------------------------------- */
  const lDays = sql<number>`(${BKK_TODAY} - ${listingFollowRef})`.mapWith(Number);
  const lOver = sql<number>`(${BKK_TODAY} - ${listingFollowRef}) - ${slaRules.maxDays}`.mapWith(Number);
  const lJoin = and(
    eq(slaRules.entity, "listing_follow"),
    sql`${slaRules.potential} = ${listings.potential}::text`
  );
  const lWhere = and(
    hasRole(listings.status, "listing_status", ACTIVE_LISTING_ROLES),
    sql`(${BKK_TODAY} - ${listingFollowRef}) > ${slaRules.maxDays}`,
    listingScope(viewer)
  );

  /* ---- buyer side: ตาม Lead ------------------------------------------ */
  const dDays = sql<number>`(${BKK_TODAY} - ${leadFollowRef})`.mapWith(Number);
  const dOver = sql<number>`(${BKK_TODAY} - ${leadFollowRef}) - ${slaRules.maxDays}`.mapWith(Number);
  const dJoin = and(
    eq(slaRules.entity, "lead_follow"),
    sql`${slaRules.potential} = ${leads.potential}::text`
  );
  const dWhere = and(
    hasRole(leads.leadStatus, "lead_status", "open"),
    sql`(${BKK_TODAY} - ${leadFollowRef}) > ${slaRules.maxDays}`,
    leadScope(viewer)
  );

  // Each side is fetched to the FULL limit, not half: a day with nothing but
  // overdue owners should still fill the card. The interleave below decides
  // the final mix, and whichever side runs out is simply backfilled.
  const [listingRows, leadRows, [{ total: totalListings }], [{ total: totalLeads }]] =
    await Promise.all([
      db
        .select({
          id: listings.id,
          // THE OWNER'S NAME, not the unit's — this is a call list, and
          // "เดอะ พาโน พระราม 3" is not who you are about to ring. The unit
          // travels alongside as the subtitle. Falls back to the listing name
          // for units whose owner contact was never filled in; a blank row
          // would be worse than a slightly wrong label.
          ownerName: contacts.name,
          listingName: listings.listingName,
          legacyCode: listings.legacyCode,
          grade: listings.potential,
          days: lDays,
          window: slaRules.maxDays,
          daysOver: lOver,
          onPlan: onPlanFor(dailyPlanTasks.listingId, listings.id, viewer.userId),
        })
        .from(listings)
        .innerJoin(slaRules, lJoin)
        .leftJoin(contacts, eq(listings.ownerId, contacts.id))
        .where(lWhere)
        .orderBy(desc(lOver))
        .limit(limit),
      db
        .select({
          id: leads.id,
          contactName: contacts.name,
          initialInterest: leads.initialInterest,
          legacyCode: leads.legacyCode,
          grade: leads.potential,
          days: dDays,
          window: slaRules.maxDays,
          daysOver: dOver,
          onPlan: onPlanFor(dailyPlanTasks.leadId, leads.id, viewer.userId),
        })
        .from(leads)
        .innerJoin(slaRules, dJoin)
        .leftJoin(contacts, eq(leads.contactId, contacts.id))
        .where(dWhere)
        .orderBy(desc(dOver))
        .limit(limit),
      db.select({ total: count() }).from(listings).innerJoin(slaRules, lJoin).where(lWhere),
      db.select({ total: count() }).from(leads).innerJoin(slaRules, dJoin).where(dWhere),
    ]);

  const listingSide: FollowUpRow[] = listingRows.map((r) => ({
    side: "listing",
    id: r.id,
    name: r.ownerName?.trim() || r.listingName || r.legacyCode || "(ไม่มีชื่อ)",
    subtitle: r.listingName ?? r.legacyCode,
    grade: r.grade,
    days: r.days,
    window: r.window,
    daysOver: r.daysOver,
    onPlan: r.onPlan,
  }));

  const leadSide: FollowUpRow[] = leadRows.map((r) => ({
    side: "lead",
    id: r.id,
    name: r.contactName?.trim() || r.legacyCode || "ลูกค้าไม่ระบุชื่อ",
    subtitle: r.initialInterest,
    grade: r.grade,
    days: r.days,
    window: r.window,
    daysOver: r.daysOver,
    onPlan: r.onPlan,
  }));

  return {
    rows: interleave(listingSide, leadSide, limit),
    totalLeads,
    totalListings,
  };
}

/** Take the worst from each side in turn, and this is NOT cosmetic.

    Ranking one merged list by daysOver alone hands every slot to whichever
    side happens to be further behind — one stale owner list with 100-day
    breaches buries every overdue buyer, and the card silently becomes a
    single-sided view of a two-sided job. Taking rank 1 from each side, then
    rank 2, guarantees both are represented and still shows the worst of each
    first. A side that runs out lets the other backfill the rest.

    Within the result, records already on the plan sort last: they are not
    work to hand out again, but hiding them would make the list read as
    shorter than the day actually is. */
function interleave(
  a: FollowUpRow[],
  b: FollowUpRow[],
  limit: number
): FollowUpRow[] {
  const out: FollowUpRow[] = [];
  for (let i = 0; i < Math.max(a.length, b.length) && out.length < limit; i++) {
    if (a[i]) out.push(a[i]);
    if (b[i] && out.length < limit) out.push(b[i]);
  }
  return out.sort((x, y) => Number(x.onPlan) - Number(y.onPlan));
}

/* ── บันทึกกิจกรรม — today's action log for the viewer ─────────────── */

export async function getTodayActions(viewer: Viewer) {
  return getDb()
    .select({
      id: actions.id,
      // `countable` in the WHERE below already excludes the NULL a plain note
      // carries, so this list never holds one.
      category: sql<string>`${actions.category}`,
      quantity: actions.quantity,
      hours: actions.hours,
      remark: actions.remark,
      recap: actions.recap,
      taskId: actions.taskId,
      // Computed rather than shipping both ids: the card only ever asks "can
      // this be removed?", and a follow-up cannot (it stamped a record).
      linked: sql<boolean>`(${actions.leadId} is not null or ${actions.listingId} is not null)`,
    })
    .from(actions)
    .where(
      and(eq(actions.agentId, viewer.userId), eq(actions.date, bkkToday()), countable)
    )
    .orderBy(asc(actions.createdAt));
}
