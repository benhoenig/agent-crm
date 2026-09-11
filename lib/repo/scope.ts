// Role scoping for the query layer (DATA_MODEL §5 — no RLS; every repository
// function takes the Viewer and applies these WHERE fragments). Keep ALL
// visibility rules here so a scoping change is a one-file diff.

import { and, eq, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, leads, listings, userZones, users } from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import type { RolePermissions, Scope } from "@/lib/auth/roles";

const NOTHING = sql`false`;

/** Subquery: zone ids assigned to a user (agents own multiple zones). */
function myZoneIds(userId: string) {
  return getDb()
    .select({ zoneId: userZones.zoneId })
    .from(userZones)
    .where(eq(userZones.userId, userId));
}

/**
 * Subquery: user ids on the same team as `userId` (for own/team/all views).
 * users.team is NULL until the Phase-5 team module assigns teams, and
 * `team IN (NULL)` matches nothing — so the viewer is always included
 * explicitly and the team match only applies when their team is set.
 * A NULL-team viewer's "team" view therefore degrades to just themselves.
 */
export function teamUserIds(userId: string) {
  const db = getDb();
  return db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        eq(users.id, userId),
        inArray(
          users.team,
          db
            .select({ team: users.team })
            .from(users)
            .where(and(eq(users.id, userId), isNotNull(users.team)))
        )
      )
    );
}

/**
 * Write gate for create actions. The read scopes model "none" per entity;
 * creates must honor it too, so a future restricted role can't insert rows
 * it can never see.
 */
export function canCreate(
  perms: RolePermissions,
  entity: "listings" | "leads" | "deals"
): boolean {
  return perms[entity] !== "none";
}

/** WHERE fragment limiting `listings` to what the viewer may see.

    OWNERSHIP OVERRIDES THE ZONE (Ben, 2026-08-29: "own will override zone…
    so that sometimes a listing that been assign to that sales for purpose
    would override the default zone").

    The zone is the DEFAULT — who covers this patch when nobody has been named
    — and naming somebody is what overrides it. Until now the two were an OR,
    which made every zone-mate a co-owner of your entire book: Do covers 42
    zones, so 848 listings belonging to other agents were his to see and to
    edit. Assigning a listing to one person on purpose could not take it away
    from everyone else, which is the opposite of what assigning means.

    So the zone clause applies to UNOWNED rows only. Nothing is orphaned by
    this: an unassigned listing still surfaces for whoever covers its zone,
    which is the routing the zone was for. Today every listing has an owner, so
    the clause matches nothing at all — it is here for the day an agent leaves
    and their stock goes back on the market. */
export function listingScope(viewer: Viewer): SQL | undefined {
  switch (viewer.perms.listings) {
    case "all":
      return undefined;
    case "own+zone":
      return or(
        eq(listings.agentId, viewer.userId),
        and(
          isNull(listings.agentId),
          inArray(listings.zoneId, myZoneIds(viewer.userId))
        )
      );
    case "own":
      return eq(listings.agentId, viewer.userId);
    case "none":
      return NOTHING;
  }
}

/** WHERE fragment limiting `leads`.

    own+zone DEGRADES TO own HERE, the way dealScope's already does, and for a
    sharper reason than "leads have no zone" — they do, through the listing
    they enquired about. It is that a lead's owner is ALWAYS set by a deliberate
    act. An unassigned lead is not unrouted, it is IN THE QUEUE: แอดมินซัพพอร์ต
    files it and hands it out, and รอจ่ายงาน is that queue. Routing the same row
    by property zone as well would be a second dispatcher disagreeing with the
    first, and the agent it reached could not claim it anyway — assignment is
    the desk's action, not theirs.

    So the zone never reaches a lead. A listing can be unowned and waiting for
    whoever covers the patch (see listingScope); a lead is either yours or
    somebody's job to give away. */
export function leadScope(viewer: Viewer): SQL | undefined {
  switch (viewer.perms.leads) {
    case "all":
      return undefined;
    case "own":
    case "own+zone":
      return or(
        eq(leads.assignedTo, viewer.userId),
        eq(leads.createdBy, viewer.userId)
      );
    case "none":
      return NOTHING;
  }
}

/** WHERE fragment limiting `deals`. Support sees none. */
export function dealScope(viewer: Viewer): SQL | undefined {
  switch (viewer.perms.deals) {
    case "all":
      return undefined;
    case "own":
    case "own+zone": // deals have no zone; own+zone degrades to own
      return eq(deals.salesId, viewer.userId);
    case "none":
      return NOTHING;
  }
}

/* ── the own book vs the directory ─────────────────────────────────────────
   ทรัพย์ and ลูกค้า Lead are WORK SURFACES — the records you are personally
   answerable for. ทรัพย์ทั้งบริษัท and Lead ทั้งบริษัท are DIRECTORIES — every
   record, read-only, for looking something up.

   THE SPLIT USED TO BE ACCIDENTAL (Ben, 2026-08-29: "why does I'm logging in
   as Do but I see other salesperson ทรัพย์ on my ทรัพย์ nav too?"). It held
   only because a plain sales agent's matrix says own+zone: the same page
   showed one person their book and another person the company, and which one
   you got depended on a permission that was never about that question. The
   moment a manager's roles started adding up (2026-08-29), Do's ทรัพย์ became
   the whole company's — the page had always behaved that way for managers,
   and nobody had been in a position to notice.

   So the work surfaces show your own book — what you hold, plus what nobody
   holds in your zones — and the directories carry "all". */

const SCOPE_ORDER: readonly Scope[] = ["none", "own", "own+zone", "all"];

/**
 * Narrow a viewer to their own book — `listings` and `leads` capped at
 * own+zone. Every other permission is untouched: this decides what a LIST
 * shows, never what its rows may do, so anyone still edits and reassigns
 * whatever they open from anywhere their real scope reaches.
 *
 * THE CAP IS SAFE ONLY BECAUSE own+zone MEANS SOMETHING NARROW NOW. It used to
 * be "mine OR anything in a zone I cover", which for Do's 42 zones was 353
 * listings of his own and 848 of other people's — the complaint that started
 * this ("why do I still see other sales listing and lead on Do login?"). Since
 * ownership overrides the zone (listingScope above), own+zone is "mine, plus
 * what nobody has claimed in my patch", which is exactly a book: your work,
 * and the work waiting for you.
 *
 * A CAP, NOT A SET: a role scoped to "none" or "own" stays there. Nothing here
 * can widen anything.
 */
export function ownBook(viewer: Viewer): Viewer {
  const cap = (s: Scope): Scope =>
    SCOPE_ORDER.indexOf(s) > SCOPE_ORDER.indexOf("own+zone") ? "own+zone" : s;
  return {
    ...viewer,
    perms: {
      ...viewer.perms,
      listings: cap(viewer.perms.listings),
      leads: cap(viewer.perms.leads),
    },
  };
}

/**
 * May the viewer browse every lead in the company (/lead-directory)?
 *
 * The Lead twin of canBrowseDirectory below, and read-only for the same
 * reason: every mutation in app/(app)/leads/actions.ts filters on leadScope(),
 * so a directory browser can read a lead they may not touch. ผู้จัดการ and
 * แอดมินซัพพอร์ต hold it.
 */
export function canBrowseLeadDirectory(viewer: Viewer): boolean {
  return viewer.perms.leadDirectory && viewer.perms.leads !== "none";
}

/**
 * May the viewer browse the company-wide inventory (/inventory)?
 *
 * This is a READ-ONLY widening and is intentionally NOT part of listingScope():
 * every mutation in app/(app)/listings/actions.ts filters on listingScope(),
 * so a directory browser can see another agent's listing but cannot edit it,
 * reassign it, or touch its media — even by forging the request. Owner contact
 * stays governed by canSeeOwnerOn() below, independently of this flag.
 */
export function canBrowseDirectory(viewer: Viewer): boolean {
  return viewer.perms.listingDirectory && viewer.perms.listings !== "none";
}

/**
 * Owner contact visibility on a specific listing: admin/manager/support see
 * all; sales only on listings they own (DATA_MODEL §5).
 */
export function canSeeOwnerOn(
  viewer: Viewer,
  listingAgentId: string | null
): boolean {
  if (viewer.perms.ownerContacts === "all") return true;
  return listingAgentId !== null && listingAgentId === viewer.userId;
}

/** Buyer/seller legal identity on deals — admin only. */
export function canSeeDealPII(viewer: Viewer): boolean {
  return viewer.perms.dealLegalPII;
}
