// โฟกัสเจ้าของ repository — the listings an agent is actively working.
//
// See lib/db/schema/property.ts listingFocus for the shape and the reasoning.
// Two rules are enforced here and nowhere else:
//
//   YOU STAR YOUR OWN. toggleFocus takes the user id from the SESSION, never
//   from the caller, so there is no request that stars something for somebody
//   else. Reading another agent's board is a separate, gated question below.
//
//   YOU CAN ONLY STAR WHAT YOU CAN SEE. The listing is re-checked against
//   listingScope on the way in. Without that, a sales agent could star a
//   listing outside their book and the board would then show them its owner's
//   name and phone — the focus list would become a hole in contactScope.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contacts, listingFocus, listings, users } from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { listingScope } from "./scope";
import { hasRole } from "./options";
import { ACTIVE_LISTING_ROLES } from "@/lib/options/kinds";

/** Is this listing on the viewer's own board? One indexed PK lookup. */
export async function isFocused(
  userId: string,
  listingId: string
): Promise<boolean> {
  const [row] = await getDb()
    .select({ listingId: listingFocus.listingId })
    .from(listingFocus)
    .where(
      and(
        eq(listingFocus.userId, userId),
        eq(listingFocus.listingId, listingId)
      )
    )
    .limit(1);
  return Boolean(row);
}

/** Which of these listings the viewer stars — for marking rows in a grid
    without one query per row. Empty in, empty out. */
export async function focusedAmong(
  userId: string,
  listingIds: string[]
): Promise<Set<string>> {
  if (listingIds.length === 0) return new Set();
  const rows = await getDb()
    .select({ listingId: listingFocus.listingId })
    .from(listingFocus)
    .where(
      and(
        eq(listingFocus.userId, userId),
        inArray(listingFocus.listingId, listingIds)
      )
    );
  return new Set(rows.map((r) => r.listingId));
}

/**
 * Star or unstar one listing for the VIEWER. Returns the state it ended in,
 * so the caller can report it without a second read.
 *
 * Returns null when the listing is not the viewer's to star — out of scope,
 * or gone. Null rather than throwing: a stale star button on a listing that
 * has just been reassigned should do nothing quietly, not 500.
 */
export async function toggleFocus(
  viewer: Viewer,
  listingId: string
): Promise<boolean | null> {
  const db = getDb();
  const [visible] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.id, listingId), listingScope(viewer)))
    .limit(1);
  if (!visible) return null;

  const on = await isFocused(viewer.userId, listingId);
  if (on) {
    await db
      .delete(listingFocus)
      .where(
        and(
          eq(listingFocus.userId, viewer.userId),
          eq(listingFocus.listingId, listingId)
        )
      );
    return false;
  }
  // onConflictDoNothing, not a plain insert: two fast taps race, and the
  // second one losing is not an error worth showing anyone.
  await db
    .insert(listingFocus)
    .values({ userId: viewer.userId, listingId })
    .onConflictDoNothing();
  return true;
}

/* ── the board ─────────────────────────────────────────────────────── */

export interface FocusListing {
  id: string;
  listingName: string | null;
  legacyCode: string | null;
  status: string;
  potential: string | null;
  askingPrice: string | null;
  rentalPrice: string | null;
  bed: number | null;
  usableSqm: string | null;
  lastFollowedAt: string | null;
  focusedAt: Date;
  /** Still on the portals / being prepared. A closed or withdrawn listing
      stays on the board rather than vanishing — see the note in focusBoard. */
  active: boolean;
}

export interface FocusOwner {
  ownerId: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  listings: FocusListing[];
}

/**
 * One agent's focus board, grouped by owner.
 *
 * ORDERED BY NEGLECT, NOT BY DATE STARRED. Owners sort by their most stale
 * listing — the longest since anyone wrote an activity on it — so the person
 * you have not called rises to the top. A board sorted newest-first would
 * show you the listing you starred this morning and bury the one you starred
 * a month ago and never rang, which is the exact failure the board exists to
 * prevent.
 *
 * CLOSED LISTINGS STAY. A sold or withdrawn listing keeps its star and keeps
 * its place, flagged inactive. Dropping it silently would make the board
 * disagree with the star the agent can still see on the listing itself, and
 * "this one is done, unstar it" is a decision for the person, not a rule.
 */
export async function focusBoard(
  agentId: string
): Promise<FocusOwner[]> {
  const rows = await getDb()
    .select({
      id: listings.id,
      listingName: listings.listingName,
      legacyCode: listings.legacyCode,
      status: listings.status,
      potential: listings.potential,
      askingPrice: listings.askingPrice,
      rentalPrice: listings.rentalPrice,
      bed: listings.bed,
      usableSqm: listings.usableSqm,
      lastFollowedAt: listings.lastFollowedAt,
      focusedAt: listingFocus.createdAt,
      ownerId: contacts.id,
      ownerName: contacts.name,
      ownerPhone: contacts.phone,
      active: hasRole(listings.status, "listing_status", ACTIVE_LISTING_ROLES),
    })
    .from(listingFocus)
    .innerJoin(listings, eq(listings.id, listingFocus.listingId))
    .leftJoin(contacts, eq(contacts.id, listings.ownerId))
    .where(eq(listingFocus.userId, agentId))
    // Stalest first, nulls (never followed) first of all — those are the ones
    // that have been starred and then left alone since the day they were.
    /* Written as raw SQL, not asc(sql`...`): drizzle appends its own ASC
       after the fragment, producing "... nulls first asc", which Postgres
       rejects outright. The null ordering is part of the direction clause,
       so the whole clause has to be one fragment. */
    .orderBy(
      sql`${listings.lastFollowedAt} asc nulls first`,
      asc(listingFocus.createdAt)
    );

  // Group in JS, preserving the order the rows arrived in: the first time an
  // owner appears is their stalest listing, so first-seen order IS the
  // neglect order. Doing it in SQL would need a window function to say the
  // same thing.
  const byOwner = new Map<string, FocusOwner>();
  for (const r of rows) {
    // An owner-less listing is a real state (the import left some, and the
    // picker can create one) — they share a single "ไม่ระบุเจ้าของ" group
    // rather than each becoming a group of one.
    const key = r.ownerId ?? "__none__";
    let group = byOwner.get(key);
    if (!group) {
      group = {
        ownerId: r.ownerId,
        ownerName: r.ownerName,
        ownerPhone: r.ownerPhone,
        listings: [],
      };
      byOwner.set(key, group);
    }
    group.listings.push({
      id: r.id,
      listingName: r.listingName,
      legacyCode: r.legacyCode,
      status: r.status,
      potential: r.potential,
      askingPrice: r.askingPrice,
      rentalPrice: r.rentalPrice,
      bed: r.bed,
      usableSqm: r.usableSqm,
      lastFollowedAt: r.lastFollowedAt,
      focusedAt: r.focusedAt,
      active: Boolean(r.active),
    });
  }
  return [...byOwner.values()];
}

/**
 * Who has a focus board, and how big. The manager's picker on /owner-focus.
 *
 * COUNTS EVERY AGENT WITH A STAR, not every user: a board of zero is not a
 * row anybody needs, and the absence is itself the message ("Su has not
 * started one"). Callers that want the full roster join this against the
 * team list themselves.
 */
export async function focusCounts(): Promise<
  { userId: string; name: string; nickname: string | null; total: number }[]
> {
  return getDb()
    .select({
      userId: listingFocus.userId,
      name: users.name,
      nickname: users.nickname,
      total: sql<number>`count(*)::int`,
    })
    .from(listingFocus)
    .innerJoin(users, eq(users.id, listingFocus.userId))
    .groupBy(listingFocus.userId, users.name, users.nickname)
    .orderBy(desc(sql`count(*)`));
}
