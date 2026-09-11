// Notifications repository — strictly personal: every read/write is scoped
// to the viewer's own rows.

import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";

const PAGE_SIZE = 30;

export async function getUnreadCount(viewer: Viewer): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, viewer.userId),
        isNull(notifications.readAt)
      )
    );
  return row.n;
}

export async function listNotifications(viewer: Viewer, rawPage = 1) {
  const db = getDb();
  const where = eq(notifications.userId, viewer.userId);
  // Clamp like listGoals/listListingUpdates — an unclamped ?page=-1 sends a
  // negative OFFSET to Postgres and 500s the page.
  const page = Math.max(1, Math.floor(rawPage) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(notifications).where(where),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
