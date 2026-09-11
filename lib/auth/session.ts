import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { mergePerms, type RolePermissions } from "./roles";
import { permsFor } from "@/lib/repo/roles";
import { resolvePosition, type PositionState } from "./position";

/**
 * Server-side session gate. The middleware's cookie check is optimistic only;
 * every protected layout/action must call this for a real DB-backed session.
 */
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
}

export async function requirePermission(
  check: (p: RolePermissions) => boolean
) {
  const session = await requireSession();
  const { perms } = await resolve(session);
  if (!check(perms)) redirect("/");
  return session;
}

/** The session shape repository functions scope by (lib/repo/scope.ts). */
export interface Viewer {
  userId: string;
  name: string;
  /**
   * The WORKING POSITION — the seat selected on the dashboard, or for an admin
   * the role they are currently borrowing (lib/auth/position.ts).
   *
   * READ THIS ONLY TO CHOOSE A VIEW, never to decide what someone may do:
   * outside an admin's borrowed seat it no longer constrains `perms` at all.
   * The dashboard is the one page that asks, and it asks through
   * getPositionViewer() below rather than through this field.
   */
  role: string;
  /** Every role granted to this user — or, for an admin borrowing a seat, the
      single role being borrowed. `roles.includes("sales")` therefore answers
      "does this person sell", which is the question its callers meant. */
  roles: string[];
  /**
   * The matrix in force. For ordinary staff this is the MERGE of every role
   * they hold, so a manager who also sells reaches both sets of pages without
   * changing seats. For an admin it is the borrowed position's matrix alone,
   * because a preview that merged with admin would preview nothing.
   */
  perms: RolePermissions;
}

/**
 * Resolve the permissions in force for a session.
 *
 * TWO ANSWERS, AND THE SPLIT IS THE WHOLE DESIGN (Ben, 2026-08-29):
 *
 *   ordinary staff   every granted role, MERGED. Holding a second role adds
 *                    menus and never removes any, so nobody switches seats to
 *                    reach a page they already have the right to open. The
 *                    selected position does not appear here at all.
 *   an admin         the selected position's matrix ALONE, so borrowing a seat
 *                    actually shows that seat. Safe in the one direction it
 *                    can move: admin already holds every field at its widest,
 *                    so borrowing can only narrow.
 *
 * Identity stays real either way: a manager reading a lead list sees the
 * company's leads under their own name, never someone else's session.
 *
 * permsFor() reads allRoles(), which is request-cached, so the merge below is
 * one query no matter how many roles a person holds.
 */
async function resolve(session: {
  user: { id: string; role: string };
}): Promise<{ role: string; roles: string[]; perms: RolePermissions }> {
  const { active, granted, narrowing } = await resolvePosition(
    session.user.id,
    session.user.role
  );
  if (narrowing) {
    return { role: active, roles: [active], perms: await permsFor(active) };
  }
  const perms = mergePerms(await Promise.all(granted.map(permsFor)));
  return { role: active, roles: granted, perms };
}

export async function getViewer(): Promise<Viewer> {
  const session = await requireSession();
  const { role, roles, perms } = await resolve(session);
  return {
    userId: session.user.id,
    name: session.user.name,
    role,
    roles,
    perms,
  };
}

/**
 * The dashboard's pair: the viewer AS THE POSITION THEY SELECTED — one role,
 * its matrix alone — and the seat list that lets it be changed.
 *
 * THE DASHBOARD ONLY, and it is the reason the position survived at all. That
 * page has two mutually exclusive readings: ภาพรวมทีม is a report on other
 * people and ของฉัน is a report on yourself, and merging the two matrices
 * would hand ของฉัน the whole company's funnel — a "my numbers" screen showing
 * everyone's numbers. So the dashboard asks who you are sitting as and scopes
 * itself accordingly, while every other page keeps the merged answer above.
 *
 * Identical to getViewer() for anyone holding a single role, and for admins.
 */
export async function getDashboardContext(): Promise<{
  viewer: Viewer;
  position: PositionState;
}> {
  const session = await requireSession();
  // The PRIMARY role, not the active one. resolvePosition is cached on
  // (userId, primaryRole), so feeding it the resolved seat instead would open
  // a second cache entry and re-run its queries for an identical answer.
  const position = await resolvePosition(session.user.id, session.user.role);
  return {
    viewer: {
      userId: session.user.id,
      name: session.user.name,
      role: position.active,
      roles: [position.active],
      perms: await permsFor(position.active),
    },
    position,
  };
}

/** Same resolution for callers holding a session already (the media route). */
export async function viewerFromSession(session: {
  user: { id: string; name: string; role: string };
}): Promise<Viewer> {
  const { role, roles, perms } = await resolve(session);
  return { userId: session.user.id, name: session.user.name, role, roles, perms };
}
