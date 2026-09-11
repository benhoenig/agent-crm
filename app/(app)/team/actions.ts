"use server";

// Team mutations. HR-profile writes are gated by perms.teamManage (admin);
// avatar + own password work for the member themselves. Account operations
// (deactivate, password reset) go through the Better Auth admin plugin so
// password hashing and session revocation behave exactly like the rest of
// auth.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userZones, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { getViewer } from "@/lib/auth/session";
import { dateStr, enumStr, reqStr, str } from "@/lib/forms";
import { allRoles } from "@/lib/repo/roles";
import { putAvatar } from "@/lib/repo/avatar";

async function requireTeamManage() {
  const viewer = await getViewer();
  if (!viewer.perms.teamManage) redirect("/team");
  return viewer;
}

export async function updateMember(id: string, fd: FormData) {
  await requireTeamManage();

  await getDb()
    .update(users)
    .set({
      name: reqStr(fd, "name"),
      nickname: str(fd, "nickname"),
      nameEng: str(fd, "nameEng"),
      nameThai: str(fd, "nameThai"),
      position: str(fd, "position"),
      secondPosition: str(fd, "secondPosition"),
      division: str(fd, "division"),
      team: str(fd, "team"),
      /* "" from the dropdown's blank option means NO manager, which str()
         already turns into null — an agent between managers is a gap someone
         fixes, not an error. Not validated against the manager list here on
         purpose: the FK does that, and a forged id simply fails the insert. */
      managerId: str(fd, "managerId"),
      employmentStatus: str(fd, "employmentStatus"),
      gender: str(fd, "gender"),
      nationality: str(fd, "nationality"),
      phone: str(fd, "phone"),
      phone2: str(fd, "phone2"),
      workEmail: str(fd, "workEmail"),
      birthday: dateStr(fd, "birthday"),
      dateStarted: dateStr(fd, "dateStarted"),
      idCardNo: str(fd, "idCardNo"),
      address: str(fd, "address"),
      remark: str(fd, "remark"),
    })
    .where(eq(users.id, id));

  revalidatePath(`/team/${id}`);
  revalidatePath("/team");
  redirect(`/team/${id}`);
}

export async function setMemberRole(id: string, fd: FormData) {
  const viewer = await requireTeamManage();

  // Never your own role — demoting yourself could lock the last admin out.
  if (id === viewer.userId) redirect(`/team/${id}`);

  const role = enumStr(fd, "role", (await allRoles()).map((r) => r.id));
  if (!role) redirect(`/team/${id}`);

  await getDb().update(users).set({ role }).where(eq(users.id, id));
  revalidatePath(`/team/${id}`);
  revalidatePath("/team");
}

export async function setMemberZones(id: string, fd: FormData) {
  await requireTeamManage();
  const db = getDb();

  const zoneIds = fd
    .getAll("zoneIds")
    .filter((v): v is string => typeof v === "string" && v !== "");

  // neon-http has no transactions: delete then insert sequentially. A crash
  // in between leaves the member zoneless — visible and re-savable, not
  // corrupting.
  await db.delete(userZones).where(eq(userZones.userId, id));
  if (zoneIds.length) {
    await db
      .insert(userZones)
      .values(zoneIds.map((zoneId) => ({ userId: id, zoneId })));
  }

  revalidatePath(`/team/${id}`);
  revalidatePath("/team");
}

/* ── Avatar (R2) ────────────────────────────────────────────────────── */

// Storage lives in lib/repo/avatar.ts — Settings → บัญชีผู้ใช้ writes avatars too,
// and the orphan cleanup and cache-busting stamp are not worth getting right
// in two places. This action keeps the FormData shape the profile form posts.

export async function uploadAvatar(id: string, fd: FormData) {
  const viewer = await getViewer();
  // a member may set their own; anyone else's needs teamManage
  if (!viewer.perms.teamManage && viewer.userId !== id) redirect("/team");

  const file = fd.get("file");
  if (!(file instanceof File)) redirect(`/team/${id}`);
  await putAvatar(id, file);

  revalidatePath(`/team/${id}`);
  revalidatePath("/team");
  revalidatePath("/", "layout"); // topbar chip
}

/* ── Account operations (Better Auth admin plugin) ──────────────────── */

export async function deactivateMember(id: string, fd: FormData) {
  const viewer = await requireTeamManage();
  if (id === viewer.userId) redirect(`/team/${id}`); // can't deactivate yourself

  await auth.api.banUser({
    body: { userId: id, banReason: str(fd, "reason") ?? undefined },
    headers: await headers(),
  });

  revalidatePath(`/team/${id}`);
  revalidatePath("/team");
}

export async function reactivateMember(id: string) {
  await requireTeamManage();
  await auth.api.unbanUser({ body: { userId: id }, headers: await headers() });
  revalidatePath(`/team/${id}`);
  revalidatePath("/team");
}

export async function resetMemberPassword(id: string, fd: FormData) {
  await requireTeamManage();
  const newPassword = reqStr(fd, "newPassword");
  if (newPassword.length < 8) throw new Error("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");

  await auth.api.setUserPassword({
    body: { userId: id, newPassword },
    headers: await headers(),
  });

  revalidatePath(`/team/${id}`);
}

/** Unlink a member's LINE account so /link can bind a new LINE user. */
export async function clearLineLink(id: string) {
  await requireTeamManage();
  await getDb().update(users).set({ lineUserId: null }).where(eq(users.id, id));
  revalidatePath(`/team/${id}`);
}

/* ── Own password (any role) ────────────────────────────────────────── */

export async function changeOwnPassword(fd: FormData) {
  await getViewer(); // session gate; changePassword itself re-checks

  const currentPassword = reqStr(fd, "currentPassword");
  const newPassword = reqStr(fd, "newPassword");
  if (newPassword.length < 8) throw new Error("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");

  // A wrong current password surfaces as Better Auth's APIError, which would
  // reach the error boundary as an opaque English string — translate it.
  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch {
    throw new Error("รหัสผ่านปัจจุบันไม่ถูกต้อง");
  }

  revalidatePath("/team");
}


/* ---------- ทีมของฉัน ------------------------------------------------------ */

/** Claim a sales agent onto the caller's own team, or release one.

    GATED ON `targetsSet`, NOT `teamManage`. Claiming a report is not editing
    an HR record: /team/[id]/edit carries ID card number, address, emergency
    contacts and agreement files, and a manager needs none of that to say who
    reports to them.

    A MANAGER CAN ONLY EVER WRITE THEIR OWN ID. The target manager is taken
    from the SESSION, never from the request, so there is no shape of this
    call that assigns somebody to a third person — which is what keeps the
    panel honest as "claim", and stops one manager quietly reshuffling
    another's team. Admin keeps the full dropdown on the edit page for the
    cases that genuinely need moving somebody sideways.

    RELEASING IS ALSO SELF-ONLY: the where-clause pins manager_id to the
    caller, so unticking somebody else's report updates zero rows rather than
    stranding them. */
export async function claimSalesMember(agentId: string, mine: boolean) {
  const viewer = await getViewer();
  if (!viewer.perms.targetsSet) return { ok: false as const };
  // Nobody manages themselves. The FK is self-referencing and would store it
  // happily, and every "who reports to me" read would then count the manager
  // as their own report. The panel already omits the caller; this is the half
  // that a forged request meets.
  if (agentId === viewer.userId) return { ok: false as const };

  const db = getDb();
  if (mine) {
    await db
      .update(users)
      .set({ managerId: viewer.userId })
      .where(eq(users.id, agentId));
  } else {
    await db
      .update(users)
      .set({ managerId: null })
      .where(and(eq(users.id, agentId), eq(users.managerId, viewer.userId)));
  }

  revalidatePath("/team");
  return { ok: true as const };
}
