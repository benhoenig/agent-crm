/* The record's activity log — reads.

   Ported in shape from the Klaichan CRM, where this replaced the same pair of
   "mark followed" buttons Habihub had (Ben, 2026-08-30). A follow is a thing
   you WROTE: the entry is the record of the work, and posting it is what moves
   the SLA clock. The writes live in app/(app)/activity-actions.ts.

   Two rules the rest of the app has to respect, and both are here so nobody
   has to remember them:

     COUNTABLE   an entry counts only if it is not withdrawn and carries a
                 kind. `countable` is that predicate; every aggregate over
                 `actions` takes it.
     SCOPED      the listing offers owner-side kinds, the lead buyer-side.
                 Klaichan's live data is the argument: an Owner Visit filed
                 against a buyer and an Appoint against a listing, neither
                 recoverable from the prose, both quietly wrong in the
                 monthly count. `scopedCategories` is the guard. */

import { and, asc, desc, eq, isNotNull, isNull, or, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { actions, options } from "@/lib/db/schema";
import { users } from "@/lib/db/schema/auth";

/** Which record a timeline belongs to. Maps onto options.scope. */
export type ActivitySide = "lead" | "listing";

/** options.scope value each side offers. */
export const SCOPE_OF: Record<ActivitySide, string> = {
  listing: "owner",
  lead: "buyer",
};

/** Counts toward anything: not withdrawn, and actually filed as work.
    A plain note (category NULL) is history, not a unit of output. */
export const countable: SQL = and(
  eq(actions.voided, false),
  isNotNull(actions.category)
)!;

/** Withdrawn rows are excluded from every aggregate; use this where a NULL
    category is impossible anyway (an inner join to options already drops it). */
export const notVoided: SQL = eq(actions.voided, false);

export interface ActivityEntry {
  id: string;
  /** The day the work happened — back-datable, and for the imported sheet
      history it is the only thing that was ever recorded. */
  date: string;
  /** When the row was actually written. Shown as a clock time next to `date`,
      but only when the two agree on the day — see activityStamp(). */
  createdAt: Date | null;
  /** NULL = โน้ต, a comment that counts for nothing. */
  category: string | null;
  remark: string | null;
  recap: "Work" | "Not Work" | null;
  voided: boolean;
  agentName: string | null;
}

/** One record's timeline, newest first. Withdrawn rows are INCLUDED — the
    whole point of withdrawing rather than deleting is that the row stays
    visible with a line through it. */
export async function getActivities(
  side: ActivitySide,
  recordId: string,
  limit = 50
): Promise<ActivityEntry[]> {
  const col = side === "lead" ? actions.leadId : actions.listingId;
  return getDb()
    .select({
      id: actions.id,
      date: actions.date,
      createdAt: actions.createdAt,
      category: actions.category,
      remark: actions.remark,
      recap: actions.recap,
      voided: actions.voided,
      agentName: users.name,
    })
    .from(actions)
    .leftJoin(users, eq(actions.agentId, users.id))
    .where(eq(col, recordId))
    .orderBy(desc(actions.date), desc(actions.createdAt))
    .limit(limit);
}

/** The kinds this side may file, in picklist order.

    Scope-less categories (ประชุม, ทำงานหน้าคอม, อื่นๆ) are admin work that
    belongs to no record, so they are offered on NEITHER timeline — they reach
    `actions` through the daily plan, which is where that work is planned. */
export async function scopedCategories(side: ActivitySide): Promise<string[]> {
  const rows = await getDb()
    .select({ key: options.key })
    .from(options)
    .where(
      and(
        eq(options.kind, "action_category"),
        eq(options.archived, false),
        eq(options.scope, SCOPE_OF[side])
      )
    )
    .orderBy(asc(options.sortOrder), asc(options.key));
  return rows.map((r) => r.key);
}

/** Is `key` allowed on this side? Archived keys pass, for the same reason
    optionStr allows them: a category archived this morning must still accept
    a correction to work done yesterday. NULL (a plain note) always passes. */
export async function categoryAllowed(
  side: ActivitySide,
  key: string | null
): Promise<boolean> {
  if (key === null) return true;
  const [row] = await getDb()
    .select({ key: options.key })
    .from(options)
    .where(
      and(
        eq(options.kind, "action_category"),
        eq(options.key, key),
        // Scope-less rows are deliberately NOT accepted here — see above.
        eq(options.scope, SCOPE_OF[side])
      )
    )
    .limit(1);
  return !!row;
}

/** The record's real last-followed date: the newest COUNTABLE entry on it, or
    null when withdrawing the last one leaves nothing behind.

    Recomputed rather than decremented, because withdrawing the newest entry
    has to fall back to the one before it — and "subtract a day" cannot do
    that. Callers write the result onto leads/listings.lastFollowedAt. */
export async function lastCountedDate(
  side: ActivitySide,
  recordId: string
): Promise<string | null> {
  const col = side === "lead" ? actions.leadId : actions.listingId;
  const [row] = await getDb()
    .select({ date: actions.date })
    .from(actions)
    .where(and(eq(col, recordId), countable))
    .orderBy(desc(actions.date))
    .limit(1);
  return row?.date ?? null;
}

/** Rows with no scope set — surfaced in Settings so the split cannot rot
    silently as the client adds categories. */
export function isUnscoped(scope: string | null): boolean {
  return scope !== "owner" && scope !== "buyer";
}

/** Kept for the ความเคลื่อนไหว card's owner half, which needs "any scope" in
    one query rather than two round trips. */
export const anyRecordScope: SQL = or(
  eq(options.scope, "owner"),
  eq(options.scope, "buyer")
)!;

/** True when a category belongs to no record at all. */
export const scopelessOption: SQL = isNull(options.scope);
