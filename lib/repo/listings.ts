// Listings repository — every read goes through listingScope(viewer).

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import {
  listingChannels,
  listingMedia,
  listings,
  listingUpdates,
  contacts,
  projects,
  slaRules,
  transitStations,
  users,
  zones,
} from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { canBrowseDirectory, canSeeOwnerOn, listingScope } from "./scope";
import type { SlaRule } from "@/lib/sla";
import { GRID_MAX_ROWS } from "@/lib/tables";



export interface ListingFilters {
  q?: string;
  status?: string;
  potential?: string;
  zoneId?: string;
  agentId?: string;
}

function listingWhere(viewer: Viewer, f: ListingFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [listingScope(viewer)];
  if (f.q) {
    const like = `%${f.q}%`;
    parts.push(
      or(
        ilike(listings.listingName, like),
        ilike(listings.legacyCode, like),
        ilike(listings.streetSoi, like),
        ilike(listings.unitNo, like)
      )
    );
  }
  if (f.status) parts.push(eq(listings.status, f.status as never));
  if (f.potential) parts.push(eq(listings.potential, f.potential as never));
  if (f.zoneId) parts.push(eq(listings.zoneId, f.zoneId));
  if (f.agentId) parts.push(eq(listings.agentId, f.agentId));
  return and(...parts); // and() drops undefined and returns undefined for none
}

export async function listListings(viewer: Viewer, f: ListingFilters) {
  const db = getDb();
  const where = listingWhere(viewer, f);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: listings.id,
        legacyCode: listings.legacyCode,
        listingName: listings.listingName,
        status: listings.status,
        potential: listings.potential,
        listingType: listings.listingType,
        propertyType: listings.propertyType,
        askingPrice: listings.askingPrice,
        rentalPrice: listings.rentalPrice,
        bed: listings.bed,
        bath: listings.bath,
        usableSqm: listings.usableSqm,
        lastFollowedAt: listings.lastFollowedAt,
        listedAt: listings.listedAt,
        postedAt: listings.postedAt,
        createdAt: listings.createdAt, // SLA fallback when both dates are null
        // Open portal-sync handoff (the ✅ successor): a pending "status" row
        // means support hasn't mirrored the CRM status on the portals yet.
        portalPending: sql<boolean>`exists (select 1 from ${listingUpdates} where ${listingUpdates.listingId} = ${listings.id} and ${listingUpdates.columnName} = 'status' and ${listingUpdates.status} = 'pending')`,
        // First still image for the list thumbnail. Correlated subquery rather
        // than a join so it can't fan out rows; listing_media_listing_idx makes
        // it an index probe per row. Extension filter keeps videos
        // (shorts_reel/hometour .mp4) and PDFs out — kind alone doesn't.
        thumbKey: sql<string | null>`(
          select m.r2_key from ${listingMedia} m
          where m.listing_id = ${listings.id}
            and m.r2_key ~* '\\.(jpg|jpeg|png|webp|gif)$'
          order by m.sort_order, m.created_at
          limit 1
        )`,
        zoneCode: zones.code,
        zoneName: zones.nameThai,
        agentName: users.name,
      })
      .from(listings)
      .leftJoin(zones, eq(listings.zoneId, zones.id))
      .leftJoin(users, eq(listings.agentId, users.id))
      .where(where)
      // The whole book in one go — the grid scrolls it, and a sort has to see
      // every row to be true (lib/tables GRID_MAX_ROWS). `total` is still
      // counted separately so the caption can admit it when the cap bites.
      .orderBy(desc(listings.updatedAt))
      .limit(GRID_MAX_ROWS),
    db.select({ total: count() }).from(listings).where(where),
  ]);

  return { rows, total, capped: total > rows.length };
}

export type ListingRow = Awaited<
  ReturnType<typeof listListings>
>["rows"][number];

/**
 * Company-wide inventory read for /inventory — the ONE read in this file that
 * deliberately skips listingScope(). Safe because the projection is identical
 * to listListings() above, which selects no `contacts` column at all: owner
 * identity cannot leak through this query regardless of who calls it. Callers
 * must still gate on canBrowseDirectory(viewer).
 */
export async function listInventory(viewer: Viewer, f: ListingFilters) {
  if (!canBrowseDirectory(viewer)) {
    return { rows: [], total: 0, capped: false };
  }
  return listListings({ ...viewer, perms: { ...viewer.perms, listings: "all" } }, f);
}

const btsAlias = alias(transitStations, "bts");
const mrtAlias = alias(transitStations, "mrt");
const arlAlias = alias(transitStations, "arl");
const agentAlias = alias(users, "agent");

/** One detail read. `scoped` false = the unscoped, read-only inventory view. */
async function selectListing(viewer: Viewer, id: string, scoped: boolean) {
  const db = getDb();
  const [row] = await db
    .select({
      listing: listings,
      zone: { code: zones.code, nameEng: zones.nameEng, nameThai: zones.nameThai },
      agent: { id: agentAlias.id, name: agentAlias.name },
      project: {
        id: projects.id,
        nameEng: projects.nameEng,
        nameThai: projects.nameThai,
      },
      owner: contacts,
      btsName: btsAlias.name,
      mrtName: mrtAlias.name,
      arlName: arlAlias.name,
    })
    .from(listings)
    .leftJoin(zones, eq(listings.zoneId, zones.id))
    .leftJoin(agentAlias, eq(listings.agentId, agentAlias.id))
    .leftJoin(projects, eq(listings.projectId, projects.id))
    .leftJoin(contacts, eq(listings.ownerId, contacts.id))
    .leftJoin(btsAlias, eq(listings.btsStationId, btsAlias.id))
    .leftJoin(mrtAlias, eq(listings.mrtStationId, mrtAlias.id))
    .leftJoin(arlAlias, eq(listings.arlStationId, arlAlias.id))
    .where(and(eq(listings.id, id), scoped ? listingScope(viewer) : undefined))
    .limit(1);

  if (!row) return null;

  const ownerVisible = canSeeOwnerOn(viewer, row.listing.agentId);
  return {
    ...row,
    owner: ownerVisible ? row.owner : null,
    ownerVisible,
    readOnly: !scoped,
  };
}

/**
 * Listing detail. Tries the viewer's own scope first; if the listing is
 * outside it and they may browse the inventory, re-reads it unscoped and
 * flags `readOnly` so the page drops every mutation affordance. Owner
 * stripping is unchanged either way — it runs off canSeeOwnerOn().
 */
export async function getListing(viewer: Viewer, id: string) {
  const own = await selectListing(viewer, id, true);
  if (own) return own;
  if (!canBrowseDirectory(viewer)) return null;
  return selectListing(viewer, id, false);
}

/** Open portal-sync handoff? — a pending "status" row in listing_updates:
    sales changed the status, listing support hasn't mirrored it on the
    portals yet (the successor of the sheet's ✅ twin statuses). */
export async function hasPendingPortalSync(listingId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: listingUpdates.id })
    .from(listingUpdates)
    .where(
      and(
        eq(listingUpdates.listingId, listingId),
        eq(listingUpdates.columnName, "status"),
        eq(listingUpdates.status, "pending")
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function getListingChannels(listingId: string) {
  return getDb()
    .select()
    .from(listingChannels)
    .where(eq(listingChannels.listingId, listingId))
    .orderBy(asc(listingChannels.channel));
}

export async function getListingUpdates(listingId: string, limit = 30) {
  return getDb()
    .select({
      id: listingUpdates.id,
      editedAt: listingUpdates.editedAt,
      columnName: listingUpdates.columnName,
      oldValue: listingUpdates.oldValue,
      newValue: listingUpdates.newValue,
      status: listingUpdates.status,
      requestedByName: users.name,
    })
    .from(listingUpdates)
    .leftJoin(users, eq(listingUpdates.requestedBy, users.id))
    .where(eq(listingUpdates.listingId, listingId))
    .orderBy(desc(listingUpdates.createdAt))
    .limit(limit);
}

export async function getListingMedia(listingId: string) {
  return getDb()
    .select()
    .from(listingMedia)
    .where(eq(listingMedia.listingId, listingId))
    .orderBy(asc(listingMedia.kind), asc(listingMedia.sortOrder));
}

/* ── Master-data option lists shared by filter bars and forms ─────── */

export async function getZoneOptions() {
  return getDb()
    .select({ id: zones.id, code: zones.code, nameThai: zones.nameThai, nameEng: zones.nameEng })
    .from(zones)
    .orderBy(asc(zones.code));
}

export async function getAgentOptions() {
  return getDb()
    .select({ id: users.id, name: users.name })
    .from(users)
    .orderBy(asc(users.name));
}

export async function getProjectOptions() {
  return getDb()
    .select({ id: projects.id, nameEng: projects.nameEng, nameThai: projects.nameThai })
    .from(projects)
    .orderBy(asc(projects.nameEng));
}

export async function getStationOptions() {
  return getDb()
    .select({
      id: transitStations.id,
      type: transitStations.type,
      code: transitStations.code,
      name: transitStations.name,
    })
    .from(transitStations)
    .orderBy(asc(transitStations.type), asc(transitStations.code));
}

export async function getSlaRules(): Promise<SlaRule[]> {
  return getDb()
    .select({
      entity: slaRules.entity,
      potential: slaRules.potential,
      maxDays: slaRules.maxDays,
    })
    .from(slaRules);
}
