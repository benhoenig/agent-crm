"use server";

// SLA tab mutations. Admin-gated (p.settings), same as the /settings layout —
// re-checked here because a server action is its own entry point.
//
// A rule is (entity, potential) → max_days, and the *absence* of a rule is a
// meaningful state: every overdue query INNER JOINs sla_rules, so a grade with
// no rule is simply never flagged. Clearing the field therefore deletes the
// row rather than writing 0 — "ไม่ตั้ง" is a real answer (that is how
// "New Lead" has always worked), and 0 would mean "late the same day".

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { slaRules } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { allKeys } from "@/lib/repo/options";
import { slaEntityDef, type SlaEntity } from "@/lib/sla";

export type SlaActionResult = { ok: true } | { ok: false; error: string };

const MAX_DAYS = 365;

function refresh() {
  // Every overdue badge, queue and dashboard count reads this table. The
  // surfaces that show them are force-dynamic, so only the pages Next may
  // have cached need poking — but /today and / are the ones a user checks
  // straight after changing a number, so keep them explicit.
  revalidatePath("/settings/sla");
  revalidatePath("/today");
  revalidatePath("/");
}

/** Set (or clear) the limit for one clock × grade. `days === null` removes
    the rule; anything else must be a whole number of days ≥ 1. */
export async function setSlaDays(
  entity: string,
  potential: string,
  days: number | null
): Promise<SlaActionResult> {
  await requirePermission((p) => p.settings);

  const def = slaEntityDef(entity);
  if (!def) return { ok: false, error: "ไม่รู้จักงานนี้" };

  // The grade must still exist in the picklist this clock reads (archived
  // included — a hidden grade can still be sitting on live rows). Anything
  // else is an orphan and may only be deleted.
  const keys = await allKeys(def.kind);
  if (!keys.includes(potential))
    return { ok: false, error: `ไม่มีเกรด “${potential}” ในรายการตัวเลือกแล้ว` };

  const db = getDb();
  const where = and(
    eq(slaRules.entity, def.entity as SlaEntity),
    eq(slaRules.potential, potential)
  );

  if (days === null) {
    await db.delete(slaRules).where(where);
    refresh();
    return { ok: true };
  }

  if (!Number.isInteger(days) || days < 1)
    return { ok: false, error: "ใส่จำนวนวันเป็นเลขจำนวนเต็มตั้งแต่ 1 ขึ้นไป" };
  if (days > MAX_DAYS)
    return { ok: false, error: `มากสุด ${MAX_DAYS} วัน — เกินกว่านี้ให้เว้นว่างไว้แทน` };

  await db
    .insert(slaRules)
    .values({ entity: def.entity, potential, maxDays: days })
    .onConflictDoUpdate({
      target: [slaRules.entity, slaRules.potential],
      set: { maxDays: days },
    });

  refresh();
  return { ok: true };
}

/** Remove a leftover rule whose grade no longer exists. Deleting it is the
    only thing that can be done with it: no row can ever match it, and it
    blocks renaming another grade onto that name (the table's unique index). */
export async function deleteSlaRule(id: string): Promise<SlaActionResult> {
  await requirePermission((p) => p.settings);
  await getDb().delete(slaRules).where(eq(slaRules.id, id));
  refresh();
  return { ok: true };
}
