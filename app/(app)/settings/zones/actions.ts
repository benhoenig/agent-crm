"use server";

// Zone editor mutations (Settings → โซน). Admin-gated (p.settings — the same
// gate as the /settings layout, re-checked here because actions are their own
// entry points). Called from the client-side inline editor (ZonesManager), so
// they take plain arguments and return { ok } results the row can surface.
//
// A zone's identity is its uuid: listings, projects and last-matches point at
// zones.id, so renaming the code or either name is free — nothing downstream
// stores the text. Deleting is the opposite: those three FKs are NO ACTION, so
// a referenced zone can't be deleted, and we say so instead of letting Postgres
// throw. user_zones cascades — the confirm popover names that consequence.

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userZones, zones } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { zoneUsageMap } from "@/lib/repo/settings";

export type ZoneActionResult = { ok: true } | { ok: false; error: string };

/** Fields the inline editor may change. Absent = leave unchanged. */
export interface ZonePatch {
  code?: string;
  nameEng?: string;
  nameThai?: string | null;
  location?: string | null;
}

async function requireSettings() {
  await requirePermission((p) => p.settings);
}

function refresh() {
  // Zone pickers are force-dynamic everywhere; only the editor page must
  // re-render now.
  revalidatePath("/settings/zones");
}

/** How many rows point at this zone, per table.

    Reads the SAME map the editor renders (lib/repo/settings.ts) rather than
    counting again here — the two disagreeing is exactly how a delete gate
    stops matching the numbers the user was shown before they clicked. */
async function zoneUsage(id: string) {
  const [exists] = await getDb()
    .select({ id: zones.id })
    .from(zones)
    .where(eq(zones.id, id))
    .limit(1);
  if (!exists) return null;
  return (
    (await zoneUsageMap()).get(id) ?? {
      listings: 0,
      projects: 0,
      lastMatches: 0,
    }
  );
}

export async function addZone(
  rawCode: string,
  rawNameEng: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireSettings();
  const code = rawCode.trim();
  const nameEng = rawNameEng.trim();
  if (!code) return { ok: false, error: "ใส่รหัสโซนก่อน" };
  if (!nameEng) return { ok: false, error: "ใส่ชื่อโซน (Eng) ก่อน" };

  const db = getDb();
  const [dup] = await db
    .select({ id: zones.id })
    .from(zones)
    .where(eq(zones.code, code));
  if (dup) return { ok: false, error: `มีรหัส “${code}” อยู่แล้ว` };

  const [created] = await db
    .insert(zones)
    .values({ code, nameEng })
    .returning({ id: zones.id });
  refresh();
  return { ok: true, id: created.id };
}

export async function updateZoneFields(
  id: string,
  patch: ZonePatch
): Promise<ZoneActionResult> {
  await requireSettings();
  const db = getDb();
  const [row] = await db.select().from(zones).where(eq(zones.id, id));
  if (!row) return { ok: false, error: "ไม่พบโซนนี้แล้ว" };

  const set: Partial<typeof zones.$inferInsert> = {};

  if (patch.code !== undefined) {
    const code = patch.code.trim();
    if (!code) return { ok: false, error: "รหัสโซนว่างไม่ได้" };
    if (code !== row.code) {
      const [dup] = await db
        .select({ id: zones.id })
        .from(zones)
        .where(and(eq(zones.code, code), ne(zones.id, id)));
      if (dup) return { ok: false, error: `มีรหัส “${code}” อยู่แล้ว` };
      set.code = code;
    }
  }

  if (patch.nameEng !== undefined) {
    const nameEng = patch.nameEng.trim();
    if (!nameEng) return { ok: false, error: "ชื่อ (Eng) ว่างไม่ได้" };
    set.nameEng = nameEng;
  }

  if (patch.nameThai !== undefined) set.nameThai = patch.nameThai?.trim() || null;
  if (patch.location !== undefined) set.location = patch.location?.trim() || null;

  if (Object.keys(set).length === 0) return { ok: true };

  await db.update(zones).set(set).where(eq(zones.id, id));
  refresh();
  return { ok: true };
}

export async function deleteZone(id: string): Promise<ZoneActionResult> {
  await requireSettings();
  const usage = await zoneUsage(id);
  if (!usage) return { ok: false, error: "ไม่พบโซนนี้แล้ว" };

  const blockers: string[] = [];
  if (usage.listings) blockers.push(`ทรัพย์ ${usage.listings} รายการ`);
  if (usage.projects) blockers.push(`โปรเจกต์ ${usage.projects} รายการ`);
  if (usage.lastMatches) blockers.push(`Last Match ${usage.lastMatches} รายการ`);
  if (blockers.length) {
    return {
      ok: false,
      error: `ลบไม่ได้ — ยังมี ${blockers.join(" · ")} อยู่ในโซนนี้ ย้ายออกก่อน`,
    };
  }

  const db = getDb();
  // user_zones has ON DELETE CASCADE, but clear it explicitly so the coverage
  // rows go in the same statement order we describe in the confirm popover.
  await db.delete(userZones).where(eq(userZones.zoneId, id));
  await db.delete(zones).where(eq(zones.id, id));
  refresh();
  return { ok: true };
}
