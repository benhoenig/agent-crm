"use server";

// รอบดันประกาศ tab mutations. Admin-gated (p.settings), same as the /settings
// layout — re-checked here because a server action is its own entry point.
//
// A cell is (grade, channel) → days, and the ABSENCE of a rule is a real
// answer: lib/repo/reposts.ts INNER JOINs repost_rules, so a pair with no rule
// simply never enters the ดันประกาศ queue. Clearing the field therefore
// deletes the row instead of writing 0 — 0 would mean "due again the same
// day", which is a different (and unworkable) instruction.

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { repostRules } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { allKeys } from "@/lib/repo/options";

export type RepostActionResult = { ok: true } | { ok: false; error: string };

const MAX_DAYS = 365;

function refresh() {
  revalidatePath("/settings/reposts");
  revalidatePath("/reposts");
}

/** Set (or clear) the cadence for one grade × channel. `days === null`
    removes the rule; anything else must be a whole number of days ≥ 1. */
export async function setRepostDays(
  gradeKey: string,
  channelKey: string,
  days: number | null
): Promise<RepostActionResult> {
  await requirePermission((p) => p.settings);

  // Both sides must still exist in their picklist (archived included — a
  // hidden option can still be sitting on live listings). Anything else is an
  // orphan and may only be deleted.
  const [grades, channels] = await Promise.all([
    allKeys("listing_potential"),
    allKeys("listing_channel"),
  ]);
  if (!grades.includes(gradeKey))
    return { ok: false, error: `ไม่มีเกรด “${gradeKey}” ในรายการตัวเลือกแล้ว` };
  if (!channels.includes(channelKey))
    return { ok: false, error: `ไม่มีช่องทาง “${channelKey}” ในรายการตัวเลือกแล้ว` };

  const db = getDb();
  const where = and(
    eq(repostRules.gradeKey, gradeKey),
    eq(repostRules.channelKey, channelKey)
  );

  if (days === null) {
    await db.delete(repostRules).where(where);
    refresh();
    return { ok: true };
  }

  if (!Number.isInteger(days) || days < 1)
    return { ok: false, error: "ใส่จำนวนวันเป็นเลขจำนวนเต็มตั้งแต่ 1 ขึ้นไป" };
  if (days > MAX_DAYS)
    return { ok: false, error: `มากสุด ${MAX_DAYS} วัน — เกินกว่านี้ให้เว้นว่างไว้แทน` };

  await db
    .insert(repostRules)
    .values({ gradeKey, channelKey, days })
    .onConflictDoUpdate({
      target: [repostRules.gradeKey, repostRules.channelKey],
      set: { days },
    });

  refresh();
  return { ok: true };
}

/** Remove a leftover rule whose grade or channel no longer exists. Deleting
    it is the only thing that can be done with it: no listing can ever match
    it, and it blocks renaming another option onto that name (the table's
    unique index on grade_key + channel_key). */
export async function deleteRepostRule(
  id: number
): Promise<RepostActionResult> {
  await requirePermission((p) => p.settings);
  await getDb().delete(repostRules).where(eq(repostRules.id, id));
  refresh();
  return { ok: true };
}
