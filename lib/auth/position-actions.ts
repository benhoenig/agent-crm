"use server";

// Working position — see lib/auth/position.ts for the rules this enforces.

import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { POSITION_COOKIE, resolvePosition } from "./position";

/**
 * Switch the caller's working position.
 *
 * Validated against resolvePosition()'s `choices`, which is built from the
 * user's GRANTED roles and the roles table — never from the cookie. That is
 * what makes the switch safe in both directions: an unknown or ungranted id is
 * ignored, and the position currently in effect can never remove แอดมิน from
 * the list and strand someone in a narrower seat.
 *
 * Persisted for a year: this is a working preference, not session state, and
 * it is re-validated on every read anyway.
 */
export async function setPosition(roleId: string) {
  const session = await requireSession();
  const { choices } = await resolvePosition(session.user.id, session.user.role);
  if (!choices.some((c) => c.id === roleId)) return;

  (await cookies()).set(POSITION_COOKIE, roleId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
