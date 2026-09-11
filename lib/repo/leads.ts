// Leads repository — every read goes through leadScope(viewer).

import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { contacts, leads, listings, users } from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { canBrowseLeadDirectory, leadScope, listingScope } from "./scope";
import { hasRole } from "./options";
import { GRID_MAX_ROWS } from "@/lib/tables";
import { ACTIVE_LISTING_ROLES } from "@/lib/options/kinds";

const assignedAlias = alias(users, "assigned");
const createdByAlias = alias(users, "creator");

/** createdAt as a Bangkok calendar date — follow-SLA fallback for rows never followed. */
const createdDateSql = sql<string>`(${leads.createdAt} at time zone 'Asia/Bangkok')::date`;

export interface LeadFilters {
  q?: string;
  stage?: string;
  status?: string;
  potential?: string;
  assignedTo?: string;
}

function leadWhere(viewer: Viewer, f: LeadFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [leadScope(viewer)];
  if (f.q) {
    const like = `%${f.q}%`;
    parts.push(
      or(
        ilike(contacts.name, like),
        ilike(contacts.phone, like),
        ilike(leads.initialInterest, like),
        ilike(leads.legacyCode, like)
      )
    );
  }
  if (f.stage) parts.push(eq(leads.pipelineStage, f.stage as never));
  if (f.status) parts.push(eq(leads.leadStatus, f.status as never));
  if (f.potential) parts.push(eq(leads.potential, f.potential as never));
  // "none" is the waiting list — leads filed but not yet handed to an agent.
  if (f.assignedTo === "none") parts.push(isNull(leads.assignedTo));
  else if (f.assignedTo) parts.push(eq(leads.assignedTo, f.assignedTo));
  return and(...parts); // and() drops undefined and returns undefined for none
}

export async function listLeads(viewer: Viewer, f: LeadFilters) {
  const db = getDb();
  const where = leadWhere(viewer, f);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: leads.id,
        legacyCode: leads.legacyCode,
        contactName: contacts.name,
        contactPhone: contacts.phone,
        listingName: listings.listingName,
        listingLegacyCode: listings.legacyCode,
        initialInterest: leads.initialInterest,
        leadType: leads.leadType,
        source: leads.source,
        contactBy: leads.contactBy,
        potential: leads.potential,
        pipelineStage: leads.pipelineStage,
        leadStatus: leads.leadStatus,
        budgetMillion: leads.budgetMillion,
        lastFollowedAt: leads.lastFollowedAt,
        createdDate: createdDateSql,
        assignedName: assignedAlias.name,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .leftJoin(listings, eq(leads.listingId, listings.id))
      .leftJoin(assignedAlias, eq(leads.assignedTo, assignedAlias.id))
      .where(where)
      // The whole book — see listListings for why the grids stopped paging.
      .orderBy(desc(leads.updatedAt))
      .limit(GRID_MAX_ROWS),
    db
      .select({ total: count() })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(where),
  ]);

  return { rows, total, capped: total > rows.length };
}

export type LeadRow = Awaited<ReturnType<typeof listLeads>>["rows"][number];

/**
 * Every lead in the company — Lead ทั้งบริษัท (/lead-directory).
 *
 * Widens the viewer to `leads: "all"` and delegates, exactly as listInventory
 * does for ทรัพย์ทั้งบริษัท: one query shape, one set of filters, and no
 * chance of the two lists drifting apart. Read-only by construction — nothing
 * mutates through this path, and every action in app/(app)/leads/actions.ts
 * still filters on the caller's real leadScope().
 *
 * The permission check is here rather than only on the page so a forged
 * request cannot reach the widened read: refused, it returns an empty page
 * instead of throwing, because an empty directory is what a role without the
 * flag should see if the nav ever leaks.
 */
export async function listLeadDirectory(viewer: Viewer, f: LeadFilters) {
  if (!canBrowseLeadDirectory(viewer)) {
    return { rows: [], total: 0, capped: false };
  }
  return listLeads({ ...viewer, perms: { ...viewer.perms, leads: "all" } }, f);
}

/** Full detail row with contact, listing, and user names. */
export async function getLead(viewer: Viewer, id: string) {
  const db = getDb();
  const [row] = await db
    .select({
      lead: leads,
      contact: contacts,
      listing: {
        id: listings.id,
        listingName: listings.listingName,
        legacyCode: listings.legacyCode,
      },
      assignedName: assignedAlias.name,
      createdByName: createdByAlias.name,
    })
    .from(leads)
    .leftJoin(contacts, eq(leads.contactId, contacts.id))
    .leftJoin(listings, eq(leads.listingId, listings.id))
    .leftJoin(assignedAlias, eq(leads.assignedTo, assignedAlias.id))
    .leftJoin(createdByAlias, eq(leads.createdBy, createdByAlias.id))
    .where(and(eq(leads.id, id), leadScope(viewer)))
    .limit(1);

  return row ?? null;
}

/* getLeadActions moved to lib/repo/activities.ts as getActivities(), which
   serves both sides and returns withdrawn rows too — the log renders them
   struck through rather than hiding them. */

/**
 * Listings for the lead form's "ความสนใจ" select — viewer-scoped and capped
 * to the most recently touched rows so the form payload stays bounded after
 * the import. A search-based picker is the eventual replacement.
 */
export async function listingOptions(viewer: Viewer, limit = 200) {
  return getDb()
    .select({
      id: listings.id,
      listingName: listings.listingName,
      legacyCode: listings.legacyCode,
    })
    .from(listings)
    .where(
      and(
        hasRole(listings.status, "listing_status", ACTIVE_LISTING_ROLES),
        listingScope(viewer)
      )
    )
    .orderBy(desc(listings.updatedAt))
    .limit(limit);
}

/** One row in the ส่งทรัพย์ให้ลูกค้า picker. Enough to tell two units in the
    same project apart without opening either — which is the whole job a
    checkbox labelled with just a name was failing at. */
export interface ShareableListing {
  id: string;
  listingName: string | null;
  legacyCode: string | null;
  status: string;
  propertyType: string | null;
  bed: number | null;
  bath: number | null;
  usableSqm: string | null;
  askingPrice: string | null;
  rentalPrice: string | null;
}

/**
 * Search behind the ส่งทรัพย์ให้ลูกค้า picker (Ben, 2026-09-11: "ควรเป็น
 * dropdown search multi select").
 *
 * THE SAME PREDICATE AS listingOptions ABOVE — listingScope plus the
 * posted/preparing roles — because both answer one question: may this lead be
 * shown this listing. What differs is REACH, and that difference was a bug.
 *
 * listingOptions caps at the most recently touched rows so a <select> payload
 * stays bounded, and the share picker was rendering one checkbox per row from
 * that same capped call — 100 of them. With 1,493 shareable listings in the
 * book the cap had stopped being a payload guard and become a CEILING: the
 * other 1,393 could not be sent to a customer at all, and nothing on the page
 * admitted it. A list you cannot search hides that; a search box that finds
 * nothing would not.
 *
 * Searching server-side lifts the ceiling WITHOUT unbounding the payload. The
 * page ships `limit` rows to open with and each keystroke asks for another
 * `limit`, so the wire cost is flat no matter how large the book grows.
 *
 * The four searched columns are listListings' `q` verbatim (lib/repo/
 * listings.ts) — name, code, soi, unit. One search idiom across the app: a
 * picker that found rows the listings page could not would be its own kind of
 * wrong.
 */
/** How many rows one look at the picker may hold.

    FIFTY, FROM THE DATA. 553 distinct project names are shareable and only
    TWO of them carry more than 20 units (185 ราชดำริ at 34, Noble Reveal at
    29). Twenty would therefore have been the complete answer for 551 of 553
    searches and a silent lie for the other two — the same failure as the
    100-row checkbox list this replaced, merely rarer and so harder to catch.
    Fifty clears the largest project outright, and `more` below covers the
    day a bigger one arrives. */
export const SHARE_PICKER_LIMIT = 50;

/** A page of picker rows, and whether it is the whole answer. */
export interface ShareableListingPage {
  rows: ShareableListing[];
  /** More matched than fit. The picker SAYS SO rather than showing a full
      list that happens to be short — a truncated list nobody is told about
      is indistinguishable from a complete one, which is exactly how 1,393
      listings stayed invisible. */
  more: boolean;
}

export async function shareableListings(
  viewer: Viewer,
  opts: { q?: string; limit?: number } = {}
): Promise<ShareableListingPage> {
  const q = (opts.q ?? "").trim();
  const limit = opts.limit ?? SHARE_PICKER_LIMIT;
  const like = `%${q}%`;
  // One row past the limit: the cheapest way to know there IS a next row
  // without counting the whole match set on every keystroke.
  const rows = await getDb()
    .select({
      id: listings.id,
      listingName: listings.listingName,
      legacyCode: listings.legacyCode,
      status: listings.status,
      propertyType: listings.propertyType,
      bed: listings.bed,
      bath: listings.bath,
      usableSqm: listings.usableSqm,
      askingPrice: listings.askingPrice,
      rentalPrice: listings.rentalPrice,
    })
    .from(listings)
    .where(
      and(
        hasRole(listings.status, "listing_status", ACTIVE_LISTING_ROLES),
        listingScope(viewer),
        // No query means "show me what is here" rather than "show me
        // nothing" — the picker opens on this list, so it must not be empty.
        q
          ? or(
              ilike(listings.listingName, like),
              ilike(listings.legacyCode, like),
              ilike(listings.streetSoi, like),
              ilike(listings.unitNo, like)
            )
          : undefined
      )
    )
    .orderBy(desc(listings.updatedAt))
    .limit(limit + 1);
  return { rows: rows.slice(0, limit), more: rows.length > limit };
}

/**
 * The waiting list: leads filed but not yet handed to an agent.
 *
 * Ordered OLDEST FIRST and carrying `waitingDays`, deliberately. A pool with
 * no age on it is where enquiries go to die — the whole reason to allow an
 * unassigned lead is that someone triages it, and they can only do that if the
 * page shows which ones have been sitting.
 */
export async function unassignedLeads(viewer: Viewer, limit = 20) {
  const db = getDb();
  const where = and(isNull(leads.assignedTo), leadScope(viewer));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: leads.id,
        contactName: contacts.name,
        contactPhone: contacts.phone,
        initialInterest: leads.initialInterest,
        source: leads.source,
        potential: leads.potential,
        createdDate: createdDateSql.as("created_date"),
        waitingDays: sql<number>`(current_date - ${createdDateSql})`.mapWith(Number),
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(where)
      .orderBy(leads.createdAt)
      .limit(limit),
    db.select({ total: count() }).from(leads).where(where),
  ]);
  return { rows, total };
}
