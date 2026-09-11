"use server";

// TEMPORARY DEV TOOL: role simulator — see lib/auth/simulate.ts for the
// removal checklist.

import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { allRoles } from "@/lib/repo/roles";
import { SIM_ROLE_COOKIE } from "./simulate";

/** Set (or clear, with null / the real role) the simulated-role cookie.
    Gated on the REAL session role — the simulated role must never be able
    to gate the simulator itself. */
export async function setSimulatedRole(roleId: string | null) {
  const session = await requireSession();
  if (session.user.role !== "superadmin") return;
  const jar = await cookies();
  if (!roleId || roleId === session.user.role) {
    jar.delete(SIM_ROLE_COOKIE);
    return;
  }
  const known = (await allRoles()).some((r) => r.id === roleId);
  if (!known) return;
  jar.set(SIM_ROLE_COOKIE, roleId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
