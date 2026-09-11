/* Avatar storage — the one place that writes avatars/{userId}.{ext} in R2
   (through lib/media/r2.ts).
   Called from the team profile page and from Settings → บัญชีผู้ใช้; neither
   owns the logic, because getting the orphan cleanup and the cache-busting
   right twice is how they drift apart.

   NO permission checks live here on purpose — the callers gate, and they gate
   differently (a member may set their OWN avatar; only teamManage may set
   someone else's). Constants and the key helper are in lib/avatar.ts, which
   the client editor also imports. */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { deleteMedia, putMedia } from "@/lib/media/r2";
import {
  AVATAR_EXT,
  AVATAR_MAX_BYTES,
  AVATAR_TYPES_TH,
  avatarKeyOf,
  type AvatarResult,
} from "@/lib/avatar";

/** Validate + store, replacing whatever the user had. Returns the new URL. */
export async function putAvatar(
  userId: string,
  file: File
): Promise<AvatarResult> {
  if (file.size === 0) return { ok: false, error: "ไฟล์ว่าง" };
  const ext = AVATAR_EXT[file.type];
  if (!ext)
    return {
      ok: false,
      error: `ใช้ได้เฉพาะไฟล์ ${AVATAR_TYPES_TH}`,
    };
  if (file.size > AVATAR_MAX_BYTES)
    return {
      ok: false,
      error: `ไฟล์ใหญ่เกิน ${AVATAR_MAX_BYTES / 1024 / 1024} MB`,
    };

  const db = getDb();
  const [current] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!current) return { ok: false, error: "ไม่พบบัญชีนี้แล้ว" };

  const key = `avatars/${userId}.${ext}`;
  await putMedia(key, await file.arrayBuffer(), file.type);

  // A previous avatar with a DIFFERENT extension is now orphaned — the bucket
  // should hold one avatar per user, not one per format they ever used.
  const prevKey = avatarKeyOf(current.image);
  if (prevKey && prevKey !== key) await deleteMedia(prevKey);

  const image = `/media/${key}?v=${Date.now()}`;
  await db.update(users).set({ image }).where(eq(users.id, userId));
  return { ok: true, image };
}

/** Remove it entirely — back to the initial-letter placeholder. */
export async function clearAvatar(userId: string): Promise<AvatarResult> {
  const db = getDb();
  const [current] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!current) return { ok: false, error: "ไม่พบบัญชีนี้แล้ว" };

  const key = avatarKeyOf(current.image);
  if (key) await deleteMedia(key);
  await db.update(users).set({ image: null }).where(eq(users.id, userId));
  return { ok: true, image: null };
}
