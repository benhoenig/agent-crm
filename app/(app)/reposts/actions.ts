"use server";

// Repost queue mutations — gated by listingUpdateQueue (the marketing-support
// permission). The cadence matrix that feeds this queue is admin-only and
// lives in app/(app)/settings/reposts/actions.ts.

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { listingChannels, portalPushes } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { bkkToday } from "@/lib/format";

/** ดันแล้ว — stamp the push. Moves the anchor (the row leaves the queue) and
    logs who did the work. */
export async function logRepost(listingId: string, channel: string) {
  const viewer = await getViewer();
  if (!viewer.perms.listingUpdateQueue) redirect("/");
  const db = getDb();

  await db
    .update(listingChannels)
    .set({ lastPushedAt: bkkToday() })
    .where(
      and(
        eq(listingChannels.listingId, listingId),
        eq(listingChannels.channel, channel)
      )
    );
  await db.insert(portalPushes).values({
    listingId,
    channel,
    by: viewer.userId,
  });
  revalidatePath("/reposts");
}
