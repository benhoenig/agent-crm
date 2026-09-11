"use server";

// Review actions for the change-request queue. Decisions are status
// transitions only — a reviewer who approves then makes the actual edit on
// the listing form (which re-audits it as "applied"). Auto-applying stringly
// stored values back into typed/enums columns is deliberately avoided.

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { listingChannels, listings, listingUpdates } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { listingScope } from "@/lib/repo/scope";
import { allKeys, roleKeys } from "@/lib/repo/options";
import { auditListingEdit } from "@/lib/repo/listing-audit";
import { bkkToday } from "@/lib/format";

async function review(id: string, status: "approved" | "rejected") {
  const viewer = await getViewer();
  if (!viewer.perms.listingUpdateQueue) return;

  await getDb()
    .update(listingUpdates)
    .set({ status })
    .where(and(eq(listingUpdates.id, id), eq(listingUpdates.status, "pending")));

  revalidatePath("/listing-updates");
}

export async function approveListingUpdate(id: string) {
  await review(id, "approved");
}

export async function rejectListingUpdate(id: string) {
  await review(id, "rejected");
}

/** Portal-sync rows (columnName "status"): the CRM row already holds the new
    status — "done" asserts every portal now matches it. Clears ALL open
    status rows of that listing in one click: the handoff is listing-level,
    and later status flips chain onto the same open handoff (see
    listings/actions.ts updateListing). */
export async function markPortalUpdated(id: string) {
  const viewer = await getViewer();
  if (!viewer.perms.listingUpdateQueue) return;
  const db = getDb();

  const [row] = await db
    .select({ listingId: listingUpdates.listingId })
    .from(listingUpdates)
    .where(
      and(
        eq(listingUpdates.id, id),
        eq(listingUpdates.columnName, "status"),
        eq(listingUpdates.status, "pending")
      )
    )
    .limit(1);
  if (!row) return;

  await db
    .update(listingUpdates)
    .set({ status: "applied" })
    .where(
      and(
        eq(listingUpdates.listingId, row.listingId),
        eq(listingUpdates.columnName, "status"),
        eq(listingUpdates.status, "pending")
      )
    );

  revalidatePath("/listing-updates");
  revalidatePath(`/listings/${row.listingId}`);
  revalidatePath("/listings");
}

/* ── รอโพสต์ queue ──────────────────────────────────────────────────── */

/**
 * Save the portal URLs support pasted, and optionally mark the listing posted.
 *
 * ONE ACTION FOR BOTH BUTTONS because they are the same write with a different
 * ending: "บันทึก URL" is posting to two portals today and two more tomorrow,
 * "โพสต์แล้ว" is that plus the status flip. Splitting them would have meant
 * two actions that must keep identical URL-handling rules forever.
 *
 * A BLANK BOX ONLY CLEARS AN EXISTING URL; it never creates an empty channel
 * row. That distinction matters more than it looks: the ดันประกาศ queue is
 * built by joining listing_channels, so a row that exists with a null url
 * would put the listing on the repost schedule pointing at nothing, while no
 * row at all correctly means "we never posted there".
 *
 * The status write goes through the same audit + portal handoff as the drawer
 * and the edit form (lib/repo/listing-audit.ts), so posting from here is
 * indistinguishable in the trail from posting from the listing itself.
 */
export async function savePostQueueUrls(listingId: string, fd: FormData) {
  const viewer = await getViewer();
  if (!viewer.perms.listingUpdateQueue) return;
  const db = getDb();

  // Scope as well as permission: the page gate says "you do this job", the
  // scope says "this listing is yours to do it to".
  const [current] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, listingId), listingScope(viewer)))
    .limit(1);
  if (!current) return;

  // Read every existing channel row ONCE. The Neon HTTP driver has no
  // interactive transactions and pays a round trip per statement, so asking
  // "does this one exist?" inside the loop cost five extra round trips to
  // answer a question one query answers for all of them.
  const existing = new Map(
    (
      await db
        .select({
          channel: listingChannels.channel,
          url: listingChannels.url,
        })
        .from(listingChannels)
        .where(eq(listingChannels.listingId, listingId))
    ).map((c) => [c.channel, c.url])
  );

  const channels = await allKeys("listing_channel");
  for (const channel of channels) {
    const raw = fd.get(`url:${channel}`);
    if (typeof raw !== "string") continue; // box not rendered — leave alone
    const url = raw.trim() || null;
    const had = existing.has(channel);

    if (!had && url === null) continue; // nothing typed, nothing to store
    if (had && existing.get(channel) === url) continue; // unchanged

    await db
      .insert(listingChannels)
      .values({ listingId, channel, url })
      .onConflictDoUpdate({
        target: [listingChannels.listingId, listingChannels.channel],
        // ONLY the url. boosted / lastPushedAt / marketingReportLink /
        // facebookAdDoc are owned by the listing drawer and the repost queue;
        // including them here would null imported values on every save.
        set: { url },
      });
  }

  if (fd.get("intent") === "post") {
    // The posted status is read off the catalog by role, never spelled out —
    // the client can rename "โพสต์แล้ว" in Settings and this must follow.
    const [postedKey] = await roleKeys("listing_status", "posted");
    if (postedKey) {
      const written = { status: postedKey, postedAt: bkkToday() };
      await db
        .update(listings)
        .set(written)
        .where(and(eq(listings.id, listingId), listingScope(viewer)));
      await auditListingEdit(listingId, current, written, viewer);
      revalidatePath("/listings");
      revalidatePath("/reposts");
    }
  }

  revalidatePath("/listing-updates");
  revalidatePath(`/listings/${listingId}`);
}
