// Roles repository — the live permission matrix (Settings → สิทธิ์การใช้งาน).
// One cached query per request serves every permsFor()/roleName() call.

import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { roles, userRoles } from "@/lib/db/schema";
import {
  mergePerms,
  parsePerms,
  permissionsFor,
  type RolePermissions,
} from "@/lib/auth/roles";

export interface RoleRow {
  id: string;
  name: string;
  description: string;
  system: boolean;
  sortOrder: number;
  perms: RolePermissions;
}

export const allRoles = cache(async (): Promise<RoleRow[]> => {
  const rows = await getDb()
    .select()
    .from(roles)
    .orderBy(asc(roles.sortOrder), asc(roles.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    system: r.system,
    sortOrder: r.sortOrder,
    perms: parsePerms(r.perms),
  }));
});

/** The live matrix for a role id. A missing row (e.g. mid-migration, or a
    deleted custom role still on a user) falls back to the code seed —
    which itself degrades unknown ids to the sales matrix. */
export async function permsFor(roleId: string): Promise<RolePermissions> {
  const row = (await allRoles()).find((r) => r.id === roleId);
  return row ? row.perms : permissionsFor(roleId);
}

/** id → display name, with the id itself as fallback. */
export async function roleNames(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const r of await allRoles()) out[r.id] = r.name;
  return out;
}

export async function roleName(roleId: string): Promise<string> {
  return (await roleNames())[roleId] ?? roleId;
}

/**
 * Every role id granted to a user, primary first.
 *
 * `users.role` is the primary and user_roles is the grant set; 0017 mirrors
 * the primary in, but this unions them anyway so a row that goes missing
 * (a hand-edited users.role, a half-applied migration) can never silently
 * drop someone's access.
 */
export const rolesForUser = cache(
  async (userId: string, primaryRole: string): Promise<string[]> => {
    const rows = await getDb()
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));
    const ids = new Set<string>([primaryRole, ...rows.map((r) => r.roleId)]);
    // primary first so callers can use [0] as the display role
    return [primaryRole, ...[...ids].filter((id) => id !== primaryRole)];
  }
);

/**
 * The effective matrix for a user if EVERY granted role applied at once,
 * merged most permissively.
 *
 * No longer on the request path. Since 2026-08-28 a viewer works as exactly
 * one position at a time (lib/auth/position.ts), so getViewer() resolves
 * through permsFor(activePosition) instead and a merged super-role never
 * exists. Kept because it is the only place that answers "what could this
 * person reach across all their seats" — nothing asks that yet.
 */
export async function permsForUser(
  userId: string,
  primaryRole: string
): Promise<RolePermissions> {
  const ids = await rolesForUser(userId, primaryRole);
  if (ids.length === 1) return permsFor(ids[0]);
  const all = await allRoles();
  return mergePerms(
    ids.map((id) => all.find((r) => r.id === id)?.perms ?? permissionsFor(id))
  );
}
