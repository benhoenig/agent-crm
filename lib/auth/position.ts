// Working position — which seat a multi-role user is in, and how far that
// choice reaches.
//
// IT REACHES ONE PAGE FOR STAFF AND THE WHOLE APP FOR ADMINS (Ben,
// 2026-08-29: "ทำงานเป็น ไม่ควรมีทุกหน้า มันควรจะมีแค่หน้าเดียวคือ Dashboard
// นอกนั้นให้มันมีเมนูเพิ่มขึ้นมาได้ ยกเว้นคนเป็นแอดมิน"). Two different jobs
// were sharing one mechanism, and only one of them wanted app-wide narrowing:
//
//   A MANAGER WHO ALSO SELLS is both, all day. Making Do pick between ผู้จัดการ
//   and เซลส์ to reach a page meant switching seats to answer a question and
//   switching back to carry on — the strip was a toll booth on his own
//   permissions. His roles now ADD UP everywhere: one merged matrix, one
//   sidebar carrying the union of the menus, no switching to reach anything.
//   The position survives as the DASHBOARD seat alone, because that is the one
//   screen where the two hats genuinely disagree — ภาพรวมทีม reads other
//   people, ของฉัน reads yourself, and no layout shows both at once.
//
//   AN ADMIN LOOKING IN is previewing a seat they do not sit in, and a preview
//   that merged with their own permissions would show nothing but their own
//   permissions. So for admins the position still narrows everything, on every
//   page, exactly as before — `narrowing` below is the flag, and it is the
//   only thing that reads differently between the two.
//
// This REPLACES the temporary role simulator (lib/auth/simulate.ts). Same
// mechanism — a cookie naming one role — promoted from a pre-launch dev tool.
//
// Two rules keep it from being privilege escalation:
//   · a non-admin may only select a position they were actually GRANTED, and
//     since their permissions are the merge of all of them, selecting one can
//     only ever change which dashboard they read;
//   · an admin may select ANY position in the company, which can only ever
//     narrow: the admin row is locked against editing
//     (settings/roles/actions.ts) and already holds every field at its widest,
//     so no other role can carry something admin lacks.
// Both are re-derived from the DB on every read, never from the cookie.

import { cache } from "react";
import { cookies } from "next/headers";
import { allRoles, rolesForUser } from "@/lib/repo/roles";
import type { RolePermissions } from "./roles";

export const POSITION_COOKIE = "hh-position";

export interface PositionChoice {
  id: string;
  name: string;
  /** false when the viewer does not hold this position — an admin looking in. */
  granted: boolean;
}

export interface PositionState {
  /** The role id every permission and scope check must use this request. */
  active: string;
  /** Positions this user may switch to, in roles-table order. */
  choices: PositionChoice[];
  /** Roles actually granted, primary first. Never affected by the cookie. */
  granted: string[];
  /**
   * Does `active` narrow this viewer's permissions APP-WIDE, or is it only the
   * dashboard seat?
   *
   * True for admins alone — they can borrow a position they do not hold, and
   * borrowing is only meaningful if it narrows. False for everyone else, whose
   * permissions are the merge of every role they hold no matter which seat is
   * selected (session.ts resolve()). Whoever reads this must also decide where
   * to render the strip: narrowing viewers get it on every page, the rest get
   * it on the dashboard, because that is the only place it still does
   * anything.
   */
  narrowing: boolean;
}

/**
 * The seat a multi-role user lands in, read as the LAST granted row in
 * roles-table order (allRoles() sorts by sort_order, id — admin 0 · manager
 * 10 · sales 20 · support 30), i.e. the most junior position they hold.
 *
 * Ben asked for "his secondary role — if he's both sales and admin he sees
 * main as sales". `users.role` plus the user_roles grant set cannot answer
 * that: user_roles has no ordering column, so rolesForUser()'s [1] is
 * whatever order Postgres happened to return. Ordering by the roles table is
 * both stable and closer to the intent — the day-to-day operational seat
 * rather than the powerful one — no matter which of the two roles is the one
 * sitting in users.role.
 *
 * EXCEPT A SUPERADMIN, WHO LANDS IN THEIR OWN SEAT (Ben, 2026-09-11: "bay
 * can't change or edit profile avatar pic for employee"). The junior-seat rule
 * above was written while a position chose a DASHBOARD and nothing else. For a
 * superadmin it ALSO narrows `perms` app-wide — see `narrowing` below — so
 * handing them the most junior role they hold did not open a different
 * dashboard, it silently revoked every superadmin power on every page.
 *
 * Bay holds superadmin + admin_support and therefore logged in as
 * admin_support, whose teamManage is false. /team/[id] draws the รูปโปรไฟล์
 * upload card only for `isSelf || teamManage`, so it disappeared from every
 * employee's profile and read as a broken avatar feature — while Bay's own
 * picture still worked, which is exactly the shape of the bug report. Amm
 * (superadmin + listing_support) was demoted the same way. Neither had touched
 * the switcher: this was the DEFAULT doing it.
 *
 * Borrowing a junior seat stays available and stays useful. It is now only a
 * CHOICE — setPosition writes the cookie, and nothing else does — which is
 * what borrowing should always have meant. A seat nobody picked must never
 * take a power away.
 *
 * AND NOR MUST IT HIDE ONE (Ben, 2026-09-11). The superadmin carve-out above
 * was the first half of that rule; this is the rest of it. A seat that can set
 * targets now wins the default outright, for anyone.
 *
 * The case that forced it: Do and Stang hold ผู้จัดการ + เซลส์, so the junior
 * rule landed them in เซลส์ — the one dashboard with no ตั้งเป้า on it. What
 * they saw instead was "ผู้จัดการยังไม่ได้ตั้งเป้ารายได้รายเดือนให้คุณ", which
 * for the two people who ARE the managers is the app describing a problem only
 * they could fix, on the one screen that hides the fix. Nothing was blocked —
 * the controls are one seat-switch away and always were, and every target list
 * (getSalesTeam, getRevenueTargets) has always included managers and the
 * viewer themselves. It was purely a default sending them to the wrong room.
 *
 * targetsSet RATHER THAN A ROLE NAME, because "ผู้จัดการ" is client-editable
 * data and a custom role can hold the same duty. The flag is the duty; the
 * name is a label on it.
 *
 * FOR EVERYONE BUT A SUPERADMIN THIS CHANGES A VIEW AND NOTHING ELSE. Their
 * perms stay the merge of every granted role (session.ts resolve), so no
 * permission moves either way — only which dashboard opens first, which is the
 * one thing the position was kept for.
 */
function defaultPosition(
  granted: string[],
  all: { id: string; perms: RolePermissions }[]
): string | null {
  if (granted.includes("superadmin")) return "superadmin";
  const held = all.filter((r) => granted.includes(r.id));
  if (held.length === 0) return null;
  // A SEAT THAT SUPERVISES BEATS THE JUNIOR ONE — see the note above.
  // `held` is in roles-table order, so of two supervising seats the more
  // senior wins, which is the same ordering every other rule here uses.
  const supervising = held.find((r) => r.perms.targetsSet);
  if (supervising) return supervising.id;
  return held[held.length - 1].id;
}

/**
 * Resolve the active position and the switchable set for a user.
 *
 * `choices` is derived from the GRANTED roles alone, so an active position can
 * never gate the switcher that leaves it: an admin working as เซลส์ still has
 * แอดมิน in the list. Cached per request — the layout renders the strip from
 * it while session.ts resolves perms from it.
 */
export const resolvePosition = cache(
  async (userId: string, primaryRole: string): Promise<PositionState> => {
    const [granted, all] = await Promise.all([
      rolesForUser(userId, primaryRole),
      allRoles(),
    ]);

    const selectable = granted.includes("superadmin")
      ? all
      : all.filter((r) => granted.includes(r.id));
    const choices: PositionChoice[] = selectable.map((r) => ({
      id: r.id,
      name: r.name,
      granted: granted.includes(r.id),
    }));

    // A cookie naming a role that was deleted, or that this user may not hold,
    // falls back rather than failing — degrade to the default seat, never out.
    const chosen = (await cookies()).get(POSITION_COOKIE)?.value ?? null;
    const active =
      chosen && choices.some((c) => c.id === chosen)
        ? chosen
        : (defaultPosition(granted, all) ?? primaryRole);

    return { active, choices, granted, narrowing: granted.includes("superadmin") };
  }
);
