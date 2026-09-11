"use server";

// Notification mutations — personal rows only; every WHERE carries
// userId = viewer.userId.

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";

export async function markAllRead() {
  const viewer = await getViewer();
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, viewer.userId),
        isNull(notifications.readAt)
      )
    );
  revalidatePath("/notifications");
  revalidatePath("/", "layout"); // topbar badge
}

export async function markRead(id: string) {
  const viewer = await getViewer();
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, viewer.userId))
    );
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
