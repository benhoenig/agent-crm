// In-app notification fan-out. Fire-and-forget from server actions: a failed
// notification must never fail the mutation it announces, so callers await
// these AFTER the main write and errors only log.

import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications, userRoles, users } from "@/lib/db/schema";
import type { Role, RolePermissions } from "@/lib/auth/roles";
import { allRoles } from "@/lib/repo/roles";

export interface Notice {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

/** Insert one notification per recipient. Silently skips an empty list. */
export async function notifyUsers(userIds: string[], notice: Notice) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  try {
    await getDb()
      .insert(notifications)
      .values(unique.map((userId) => ({ userId, ...notice })));
  } catch (err) {
    console.error("[notify] insert failed:", err);
  }
}

/**
 * Notify every active user whose role's LIVE matrix passes `check` — the
 * custom-roles-safe fan-out (a static role list goes stale the moment a
 * custom role is granted the permission).
 */
export async function notifyPermission(
  check: (p: RolePermissions) => boolean,
  notice: Notice,
  excludeUserId?: string
) {
  try {
    const roleIds = (await allRoles())
      .filter((r) => check(r.perms))
      .map((r) => r.id);
    if (!roleIds.length) return;
    const recipients = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          // user_roles, not users.role: a manager who is ALSO sales holds the
          // role as a secondary grant and must still be notified (0017).
          inArray(
            users.id,
            getDb()
              .select({ id: userRoles.userId })
              .from(userRoles)
              .where(inArray(userRoles.roleId, roleIds))
          ),
          eq(users.banned, false),
          excludeUserId ? ne(users.id, excludeUserId) : undefined
        )
      );
    await notifyUsers(
      recipients.map((r) => r.id),
      notice
    );
  } catch (err) {
    console.error("[notify] permission fan-out failed:", err);
  }
}

/**
 * Notify every active user holding one of `roles`, except `excludeUserId`
 * (the actor — nobody needs a notification about their own action).
 */
export async function notifyRoles(
  roles: Role[],
  notice: Notice,
  excludeUserId?: string
) {
  try {
    const recipients = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(
            users.id,
            getDb()
              .select({ id: userRoles.userId })
              .from(userRoles)
              .where(inArray(userRoles.roleId, roles))
          ),
          eq(users.banned, false),
          excludeUserId ? ne(users.id, excludeUserId) : undefined
        )
      );
    await notifyUsers(
      recipients.map((r) => r.id),
      notice
    );
  } catch (err) {
    console.error("[notify] role fan-out failed:", err);
  }
}
