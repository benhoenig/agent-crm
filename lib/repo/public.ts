// Token-scoped reads for the PUBLIC pages (/share/{token},
// /owner-report/{token}). Nothing here goes through the viewer scope system
// — the token IS the authorisation, and every query is pinned to the rows
// that token names.
//
// THE PROJECTION IS THE PRIVACY BOUNDARY. A buyer sees a curated listing:
// never the owner (id, phone, or via any join), never the unit number,
// never internal remarks. Columns are hand-picked; adding one here is a
// privacy decision, not a convenience.

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  actions,
  contacts,
  leads,
  listingChannels,
  listingMedia,
  listings,
  ownerLinks,
  projects,
  shareListings,
  shares,
  zones,
} from "@/lib/db/schema";
import { countable } from "./activities";

/* ── buyer share rooms ─────────────────────────────────────────────── */

/** The public-safe slice of one listing in a share. */
export interface SharedListing {
  id: string;
  sortOrder: number;
  feedback: "interested" | "rejected" | null;
  feedbackReasons: string[] | null;
  listingName: string | null;
  projectName: string | null;
  zoneName: string | null;
  propertyType: string | null;
  listingType: string | null;
  askingPrice: string | null;
  rentalPrice: string | null;
  priceRemark: string | null;
  bed: number | null;
  bath: number | null;
  usableSqm: string | null;
  floor: string | null;
  view: string | null;
  direction: string | null;
  unitCondition: string | null;
  googleMapsLink: string | null;
  photoKeys: string[];
}

export interface ShareRoom {
  token: string;
  buyerName: string | null;
  createdAt: Date;
  listings: SharedListing[];
}

/** The live share behind a token, or null (unknown or revoked → same null,
    so a revoked link is indistinguishable from a wrong one). */
export async function getShareRoom(token: string): Promise<ShareRoom | null> {
  const db = getDb();
  const [share] = await db
    .select({
      id: shares.id,
      token: shares.token,
      createdAt: shares.createdAt,
      buyerName: contacts.name,
    })
    .from(shares)
    .leftJoin(leads, eq(leads.id, shares.leadId))
    .leftJoin(contacts, eq(contacts.id, leads.contactId))
    .where(and(eq(shares.token, token), isNull(shares.revokedAt)))
    .limit(1);
  if (!share) return null;

  const rows = await db
    .select({
      sl: shareListings,
      l: {
        id: listings.id,
        listingName: listings.listingName,
        propertyType: listings.propertyType,
        listingType: listings.listingType,
        askingPrice: listings.askingPrice,
        rentalPrice: listings.rentalPrice,
        priceRemark: listings.priceRemark,
        bed: listings.bed,
        bath: listings.bath,
        usableSqm: listings.usableSqm,
        floor: listings.floor,
        view: listings.view,
        direction: listings.direction,
        unitCondition: listings.unitCondition,
        googleMapsLink: listings.googleMapsLink,
      },
      projectName: projects.nameThai,
      projectNameEng: projects.nameEng,
      zoneName: zones.nameThai,
      zoneNameEng: zones.nameEng,
    })
    .from(shareListings)
    .innerJoin(listings, eq(listings.id, shareListings.listingId))
    .leftJoin(projects, eq(projects.id, listings.projectId))
    .leftJoin(zones, eq(zones.id, listings.zoneId))
    .where(eq(shareListings.shareId, share.id))
    .orderBy(asc(shareListings.sortOrder));

  const ids = rows.map((r) => r.l.id);
  const media = ids.length
    ? await db
        .select({
          listingId: listingMedia.listingId,
          r2Key: listingMedia.r2Key,
        })
        .from(listingMedia)
        .where(
          and(
            inArray(listingMedia.listingId, ids),
            inArray(listingMedia.kind, ["original", "new_photo"])
          )
        )
        .orderBy(asc(listingMedia.sortOrder))
    : [];
  const photosByListing = new Map<string, string[]>();
  for (const m of media) {
    const list = photosByListing.get(m.listingId) ?? [];
    list.push(m.r2Key);
    photosByListing.set(m.listingId, list);
  }

  return {
    token: share.token,
    buyerName: share.buyerName,
    createdAt: share.createdAt,
    listings: rows.map((r) => ({
      id: r.l.id,
      sortOrder: r.sl.sortOrder,
      feedback: r.sl.feedback,
      feedbackReasons: r.sl.feedbackReasons,
      listingName: r.l.listingName,
      projectName: r.projectName ?? r.projectNameEng,
      zoneName: r.zoneName ?? r.zoneNameEng,
      propertyType: r.l.propertyType,
      listingType: r.l.listingType,
      askingPrice: r.l.askingPrice,
      rentalPrice: r.l.rentalPrice,
      priceRemark: r.l.priceRemark,
      bed: r.l.bed,
      bath: r.l.bath,
      usableSqm: r.l.usableSqm,
      floor: r.l.floor,
      view: r.l.view,
      direction: r.l.direction,
      unitCondition: r.l.unitCondition,
      googleMapsLink: r.l.googleMapsLink,
      photoKeys: photosByListing.get(r.l.id) ?? [],
    })),
  };
}

/** Fire-and-forget view stamp — must never fail the page. */
export async function recordShareView(token: string) {
  try {
    await getDb()
      .update(shares)
      .set({
        lastViewedAt: new Date(),
        viewCount: sql`${shares.viewCount} + 1`,
      })
      .where(and(eq(shares.token, token), isNull(shares.revokedAt)));
  } catch (err) {
    console.error("[share] view stamp failed:", err);
  }
}

/** Is this listing inside this live share? (The media route's token gate.) */
export async function shareCoversListing(
  token: string,
  listingId: string
): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: shareListings.listingId })
    .from(shareListings)
    .innerJoin(shares, eq(shares.id, shareListings.shareId))
    .where(
      and(
        eq(shares.token, token),
        isNull(shares.revokedAt),
        eq(shareListings.listingId, listingId)
      )
    )
    .limit(1);
  return !!row;
}

/* ── owner reports ─────────────────────────────────────────────────── */

export interface OwnerReportListing {
  id: string;
  listingName: string | null;
  status: string | null;
  potential: string | null;
  listedAt: string | null;
  postedAt: string | null;
  askingPrice: string | null;
  rentalPrice: string | null;
  photoKey: string | null;
  channels: { channel: string; lastPushedAt: string | null; boosted: boolean }[];
  followUps30d: number;
}

export interface OwnerReport {
  token: string;
  ownerName: string | null;
  listings: OwnerReportListing[];
}

export async function getOwnerReport(token: string): Promise<OwnerReport | null> {
  const db = getDb();
  const [link] = await db
    .select({
      id: ownerLinks.id,
      token: ownerLinks.token,
      ownerId: ownerLinks.ownerId,
      ownerName: contacts.name,
    })
    .from(ownerLinks)
    .innerJoin(contacts, eq(contacts.id, ownerLinks.ownerId))
    .where(and(eq(ownerLinks.token, token), isNull(ownerLinks.revokedAt)))
    .limit(1);
  if (!link) return null;

  const rows = await db
    .select({
      id: listings.id,
      listingName: listings.listingName,
      status: listings.status,
      potential: listings.potential,
      listedAt: listings.listedAt,
      postedAt: listings.postedAt,
      askingPrice: listings.askingPrice,
      rentalPrice: listings.rentalPrice,
    })
    .from(listings)
    .where(eq(listings.ownerId, link.ownerId))
    .orderBy(asc(listings.createdAt));
  const ids = rows.map((r) => r.id);
  if (!ids.length) return { token: link.token, ownerName: link.ownerName, listings: [] };

  const [media, channels, followCounts] = await Promise.all([
    db
      .select({ listingId: listingMedia.listingId, r2Key: listingMedia.r2Key })
      .from(listingMedia)
      .where(
        and(
          inArray(listingMedia.listingId, ids),
          inArray(listingMedia.kind, ["original", "new_photo"])
        )
      )
      .orderBy(asc(listingMedia.sortOrder)),
    db
      .select({
        listingId: listingChannels.listingId,
        channel: listingChannels.channel,
        lastPushedAt: listingChannels.lastPushedAt,
        boosted: listingChannels.boosted,
      })
      .from(listingChannels)
      .where(inArray(listingChannels.listingId, ids)),
    db
      .select({
        listingId: actions.listingId,
        n: sql<number>`count(*)::int`,
      })
      .from(actions)
      .where(
        and(
          inArray(actions.listingId, ids),
          sql`${actions.date} >= (current_date - interval '30 days')`,
          // The owner is being shown a number; a withdrawn entry or a plain
          // note must not inflate it.
          countable
        )
      )
      .groupBy(actions.listingId),
  ]);

  const photoBy = new Map<string, string>();
  for (const m of media) if (!photoBy.has(m.listingId)) photoBy.set(m.listingId, m.r2Key);
  const followBy = new Map(followCounts.map((f) => [f.listingId, f.n]));

  return {
    token: link.token,
    ownerName: link.ownerName,
    listings: rows.map((r) => ({
      ...r,
      photoKey: photoBy.get(r.id) ?? null,
      channels: channels.filter((c) => c.listingId === r.id),
      followUps30d: followBy.get(r.id) ?? 0,
    })),
  };
}

export async function recordOwnerView(token: string) {
  try {
    await getDb()
      .update(ownerLinks)
      .set({
        lastViewedAt: new Date(),
        viewCount: sql`${ownerLinks.viewCount} + 1`,
      })
      .where(and(eq(ownerLinks.token, token), isNull(ownerLinks.revokedAt)));
  } catch (err) {
    console.error("[owner-report] view stamp failed:", err);
  }
}

/** Does this live owner link cover this listing? (Media route token gate.) */
export async function ownerLinkCoversListing(
  token: string,
  listingId: string
): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: listings.id })
    .from(listings)
    .innerJoin(ownerLinks, eq(ownerLinks.ownerId, listings.ownerId))
    .where(
      and(
        eq(ownerLinks.token, token),
        isNull(ownerLinks.revokedAt),
        eq(listings.id, listingId)
      )
    )
    .limit(1);
  return !!row;
}
