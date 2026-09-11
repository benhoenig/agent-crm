// ─── TEMPORARY DEV TOOL: role simulator ─────────────────────────────────────
// Lets an ADMIN view the app as another role to verify nav visibility and
// permission gating before launch. Grep "role simulator" to find every touch
// point when it's time to delete:
//   lib/auth/simulate.ts (this file) · lib/auth/simulate-actions.ts ·
//   components/RoleSimulator.tsx · lib/auth/session.ts ·
//   app/(app)/layout.tsx · app/media/[...key]/route.ts · components/Topbar.tsx
//
// Safety: the cookie is only honoured when the REAL session role is admin,
// and permsFor() degrades unknown role ids to the sales matrix — so the
// simulation can only ever narrow access, never widen it.

import { cookies } from "next/headers";

export const SIM_ROLE_COOKIE = "hh-sim-role";

/** The simulated role id, or null when not simulating (or not allowed to). */
export async function simulatedRoleFor(
  realRole: string
): Promise<string | null> {
  if (realRole !== "superadmin") return null;
  const value = (await cookies()).get(SIM_ROLE_COOKIE)?.value ?? null;
  return value && value !== realRole ? value : null;
}

/** The role every permission/scope check should use for this request. */
export async function effectiveRole(realRole: string): Promise<string> {
  return (await simulatedRoleFor(realRole)) ?? realRole;
}
