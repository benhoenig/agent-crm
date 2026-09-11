"use server";

// Role-matrix mutations (Settings → สิทธิ์การใช้งาน). Called from the
// client-side master–detail editor (RolesManager), so — like the options
// editor — they take plain arguments and return { ok } results the UI can
// surface inline. Guard rules:
//  - "superadmin" is untouchable — its matrix is the lockout insurance.
//  - system roles can be re-tuned but not deleted.
//  - a custom role deletes only when no user carries it.

import { revalidatePath } from "next/cache";
import { count, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { roles, userRoles } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/session";
import {
  parsePerms,
  sanitizePermPatch,
  type RolePermissions,
} from "@/lib/auth/roles";

export type RoleActionResult = { ok: true } | { ok: false; error: string };

async function requireSettings() {
  await requirePermission((p) => p.settings);
}

function refresh() {
  revalidatePath("/settings/roles");
}

/** Rename / re-describe a role. Auto-saves on blur from the editor header. */
export async function updateRoleMeta(
  id: string,
  patch: { name?: string; description?: string }
): Promise<RoleActionResult> {
  await requireSettings();
  if (id === "superadmin") return { ok: false, error: "บทบาทซูเปอร์แอดมินล็อกถาวร" };
  const db = getDb();
  const [row] = await db.select().from(roles).where(eq(roles.id, id));
  if (!row) return { ok: false, error: "ไม่พบบทบาทนี้" };

  const set: { name?: string; description?: string } = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return { ok: false, error: "ชื่อบทบาทว่างไม่ได้" };
    set.name = name;
  }
  if (patch.description !== undefined) set.description = patch.description.trim();
  if (Object.keys(set).length === 0) return { ok: true };

  await db.update(roles).set(set).where(eq(roles.id, id));
  refresh();
  return { ok: true };
}

/**
 * Patch permission fields — one toggle/select per call from the editor.
 *
 * MERGED IN THE DATABASE, NOT IN NODE. This read the row, spread the patch
 * over a fully-defaulted copy of it, and wrote all nineteen fields back. Two
 * toggles flipped in quick succession both read the row before either had
 * written, so the second write carried the FIRST field's old value and undid
 * it — both calls returned ok, the editor flashed "บันทึกแล้ว" twice, and one
 * of the two switches was back off after a refresh (Ben, 2026-09-11: "I
 * clicked changing role on the admin support and ... nothing happens").
 *
 * Now the patch is validated to just the keys it really carries and merged
 * into the stored jsonb by Postgres in a single statement, so concurrent
 * toggles of DIFFERENT fields cannot clobber each other and no field the
 * caller never named is ever rewritten. (Two toggles of the SAME field still
 * resolve last-write-wins, which is the correct answer for one switch.)
 *
 * It is also one database round trip instead of two.
 */
export async function updateRolePerms(
  id: string,
  patch: Partial<RolePermissions>
): Promise<RoleActionResult> {
  await requireSettings();
  if (id === "superadmin") return { ok: false, error: "บทบาทซูเปอร์แอดมินล็อกถาวร" };

  // Dropped, not defaulted: an unknown key writes nothing rather than
  // silently rewriting a field nobody asked about.
  const clean = sanitizePermPatch(patch);
  if (Object.keys(clean).length === 0) return { ok: true };

  const [row] = await getDb()
    .update(roles)
    .set({
      perms: sql`${roles.perms} || ${JSON.stringify(clean)}::jsonb`,
    })
    .where(eq(roles.id, id))
    .returning({ id: roles.id });
  if (!row) return { ok: false, error: "ไม่พบบทบาทนี้" };

  refresh();
  return { ok: true };
}

/** New custom role cloned from an existing one; returns the id so the
    editor can navigate straight to it. */
export async function addRole(
  rawName: string,
  cloneFrom: string
): Promise<RoleActionResult & { id?: string }> {
  await requireSettings();
  const name = rawName.trim();
  if (!name) return { ok: false, error: "ใส่ชื่อบทบาทก่อน" };
  const db = getDb();

  const [base] = await db.select().from(roles).where(eq(roles.id, cloneFrom));
  const [last] = await db.select({ n: count() }).from(roles);
  const id = `role-${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(roles).values({
    id,
    name,
    description: "",
    system: false,
    sortOrder: ((last?.n ?? 0) + 1) * 10,
    perms: parsePerms(base?.perms ?? null), // no base → sales defaults
  });
  refresh();
  return { ok: true, id };
}

/** Delete a custom role — refused while any user still carries it. */
export async function deleteRole(id: string): Promise<RoleActionResult> {
  await requireSettings();
  const db = getDb();
  const [row] = await db.select().from(roles).where(eq(roles.id, id));
  if (!row) return { ok: false, error: "ไม่พบบทบาทนี้" };
  if (row.system) return { ok: false, error: "บทบาทหลักของระบบลบไม่ได้" };
  // grant set, so a role held only as a secondary still blocks deletion
  const [inUse] = await db
    .select({ n: count() })
    .from(userRoles)
    .where(eq(userRoles.roleId, id));
  if ((inUse?.n ?? 0) > 0) {
    return {
      ok: false,
      error: `ยังมีสมาชิก ${inUse!.n} คนใช้บทบาทนี้ — ย้ายบทบาทให้พวกเขาก่อน`,
    };
  }
  await db.delete(roles).where(eq(roles.id, id));
  refresh();
  return { ok: true };
}
