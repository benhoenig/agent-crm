// CRM-side reads for share rooms + owner links (the public side reads
// through lib/repo/public.ts; this side is for the people who create them).

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  listings,
  ownerLinks,
  shareListings,
  shares,
  users,
} from "@/lib/db/schema";

export async function listSharesForLead(leadId: string) {
  const db = getDb();
  const shareRows = await db
    .select({
      id: shares.id,
      token: shares.token,
      createdAt: shares.createdAt,
      revokedAt: shares.revokedAt,
      lastViewedAt: shares.lastViewedAt,
      viewCount: shares.viewCount,
      createdByName: users.name,
    })
    .from(shares)
    .leftJoin(users, eq(users.id, shares.createdBy))
    .where(eq(shares.leadId, leadId))
    .orderBy(desc(shares.createdAt));
  if (!shareRows.length) return [];

  const rows = await db
    .select({
      shareId: shareListings.shareId,
      listingId: shareListings.listingId,
      sortOrder: shareListings.sortOrder,
      feedback: shareListings.feedback,
      feedbackReasons: shareListings.feedbackReasons,
      feedbackAt: shareListings.feedbackAt,
      listingName: listings.listingName,
      legacyCode: listings.legacyCode,
    })
    .from(shareListings)
    .innerJoin(listings, eq(listings.id, shareListings.listingId))
    .orderBy(asc(shareListings.sortOrder));

  return shareRows.map((s) => ({
    ...s,
    listings: rows.filter((r) => r.shareId === s.id),
  }));
}

/** The owner's LIVE link, if any — one live link per owner by convention
    (creating a new one revokes the old, see the action). */
export async function getLiveOwnerLink(ownerId: string) {
  const [row] = await getDb()
    .select()
    .from(ownerLinks)
    .where(and(eq(ownerLinks.ownerId, ownerId), isNull(ownerLinks.revokedAt)))
    .orderBy(desc(ownerLinks.createdAt))
    .limit(1);
  return row ?? null;
}
