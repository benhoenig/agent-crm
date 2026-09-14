"use server";

// Settings → บัญชีผู้ใช้ mutations.
//
// GATING: seeing the tab needs p.settings (the /settings layout), but every
// write here needs p.teamManage — the same gate app/(app)/team/actions.ts
// uses. They are separate toggles in the roles matrix, and an admin who gave
// a custom role `settings` but not `teamManage` did not mean "may reset other
// people's passwords". Requiring both never widens access.
//
// Account identity (email) is deliberately NOT editable: it is the login, and
// changing it out from under Better Auth's account row is a different job
// from editing a profile. Password reset + suspend are the levers instead.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userRoles, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { getViewer } from "@/lib/auth/session";
import { allRoles } from "@/lib/repo/roles";
import { allKeys, roleKeys } from "@/lib/repo/options";
import { clearAvatar, putAvatar } from "@/lib/repo/avatar";

export type AccountResult = { ok: true } | { ok: false; error: string };

const MIN_PASSWORD = 8;

async function gate(): Promise<
  { ok: true; viewerId: string } | { ok: false; error: string }
> {
  const viewer = await getViewer();
  if (!viewer.perms.teamManage)
    return { ok: false, error: "ต้องมีสิทธิ์จัดการพนักงานถึงจะแก้ตรงนี้ได้" };
  return { ok: true, viewerId: viewer.userId };
}

function refresh(id?: string) {
  revalidatePath("/settings");
  revalidatePath("/team");
  if (id) revalidatePath(`/team/${id}`);
  revalidatePath("/", "layout"); // the topbar chip carries name + avatar
}

/* ── Profile fields ─────────────────────────────────────────────────── */

export interface AccountPatch {
  name?: string;
  nickname?: string | null;
}

/** Auto-save from the inline editor. One field per call. */
export async function updateAccountFields(
  id: string,
  patch: AccountPatch
): Promise<AccountResult> {
  const g = await gate();
  if (!g.ok) return g;

  const set: { name?: string; nickname?: string | null } = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return { ok: false, error: "ชื่อที่แสดงว่างไม่ได้" };
    set.name = name;
  }
  if (patch.nickname !== undefined) {
    const nickname = patch.nickname?.trim() || null;
    // The LINE bot resolves /link and /<name>plan by nickname first, so a
    // duplicate makes one of the two unreachable by name.
    if (nickname) {
      const [clash] = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(
          and(sql`lower(${users.nickname}) = lower(${nickname})`, ne(users.id, id))
        )
        .limit(1);
      if (clash)
        return {
          ok: false,
          error: `ชื่อเล่น “${nickname}” ซ้ำกับคนอื่น — บอท LINE จะเรียกผิดคน`,
        };
    }
    set.nickname = nickname;
  }

  if (Object.keys(set).length === 0) return { ok: true };
  await getDb().update(users).set(set).where(eq(users.id, id));
  refresh(id);
  return { ok: true };
}

/* ── Role ───────────────────────────────────────────────────────────── */

export async function setAccountRole(
  id: string,
  role: string
): Promise<AccountResult> {
  const g = await gate();
  if (!g.ok) return g;
  // Never your own — demoting yourself could lock the last admin out.
  if (id === g.viewerId)
    return { ok: false, error: "เปลี่ยนสิทธิ์ของตัวเองไม่ได้" };

  const roles = await allRoles();
  if (!roles.some((r) => r.id === role))
    return { ok: false, error: "ไม่พบบทบาทนี้" };

  const db = getDb();
  // The primary is always part of the grant set (0017), so moving it must add
  // the new one — otherwise a promotion would leave someone holding perms from
  // a role they no longer have as primary and lacking the one they do.
  await db.update(users).set({ role }).where(eq(users.id, id));
  await db.insert(userRoles).values({ userId: id, roleId: role }).onConflictDoNothing();
  refresh(id);
  return { ok: true };
}

/**
 * Replace a user's ADDITIONAL roles (Ben, 2026-08-25: an employee can be sales
 * and manager at once). The primary is untouched and always kept in the set.
 */
export async function setAccountExtraRoles(
  id: string,
  roleIds: string[]
): Promise<AccountResult> {
  const g = await gate();
  if (!g.ok) return g;
  // Same rule as the primary: never edit your own grants.
  if (id === g.viewerId)
    return { ok: false, error: "เปลี่ยนสิทธิ์ของตัวเองไม่ได้" };

  const db = getDb();
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, id));
  if (!user) return { ok: false, error: "ไม่พบบัญชีนี้" };

  const known = new Set((await allRoles()).map((r) => r.id));
  const extras = [...new Set(roleIds)].filter(
    (r) => known.has(r) && r !== user.role
  );

  await db.delete(userRoles).where(eq(userRoles.userId, id));
  await db
    .insert(userRoles)
    .values([user.role, ...extras].map((roleId) => ({ userId: id, roleId })))
    .onConflictDoNothing();
  refresh(id);
  return { ok: true };
}

/* ── Employment status (HR record) ──────────────────────────────────── */

export type StatusResult =
  | { ok: true; suspended: boolean }
  | { ok: false; error: string };

/** Set the HR status — and, when the new status is tagged `departed`, suspend
    the login with it.

    ASYMMETRIC ON PURPOSE:

      departed  → also ban. Someone off the payroll must not keep a working
                  credential, and a warning that relies on an admin noticing it
                  is not enforcement. Goes through the plugin so live sessions
                  are revoked, not just future sign-ins.

      back      → does NOT auto-unban. An account can be suspended for reasons
                  that have nothing to do with employment (a security incident,
                  a disciplinary hold), and an HR clerk marking someone Active
                  must not silently reopen it. Restoring stays a separate,
                  deliberate click.

    The alternative — deriving access from employment_status at sign-in — was
    rejected: requireSession() runs on every request in the root layout and is
    already the app's most failure-prone call. Access control belongs on the
    flag Better Auth already enforces. */
export async function setAccountEmploymentStatus(
  id: string,
  status: string | null
): Promise<StatusResult> {
  const g = await gate();
  if (!g.ok) return g;

  const value = status?.trim() || null;
  if (value) {
    // archived accepted — a retired status can still sit on existing rows
    const keys = await allKeys("employment_status");
    if (!keys.includes(value))
      return { ok: false, error: `ไม่มีสถานะ “${value}” ในรายการตัวเลือกแล้ว` };
  }

  const db = getDb();
  const [current] = await db
    .select({ banned: users.banned })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!current) return { ok: false, error: "ไม่พบบัญชีนี้แล้ว" };

  const departed = value
    ? (await roleKeys("employment_status", "departed")).includes(value)
    : false;

  // Never lock yourself out: an admin tidying their own HR row should not be
  // able to revoke their own session mid-edit.
  if (departed && id === g.viewerId)
    return {
      ok: false,
      error: "ตั้งสถานะ ‘ออกแล้ว’ ให้ตัวเองไม่ได้ — จะโดนระงับบัญชีตัวเอง",
    };

  await db.update(users).set({ employmentStatus: value }).where(eq(users.id, id));

  let suspended = false;
  if (departed && !current.banned) {
    await auth.api.banUser({
      body: { userId: id, banReason: `สถานะพนักงาน: ${value}` },
      headers: await headers(),
    });
    suspended = true;
  }

  refresh(id);
  return { ok: true, suspended };
}

/* ── Suspend / restore (Better Auth admin plugin) ───────────────────── */

export async function setAccountBanned(
  id: string,
  banned: boolean,
  reason?: string
): Promise<AccountResult> {
  const g = await gate();
  if (!g.ok) return g;
  if (id === g.viewerId && banned)
    return { ok: false, error: "ระงับบัญชีตัวเองไม่ได้" };

  // Through the plugin, not a column write: banning must also revoke live
  // sessions, which a plain UPDATE would not do.
  if (banned) {
    await auth.api.banUser({
      body: {
        userId: id,
        // Better Auth writes the literal string "No reason" when this is
        // omitted, and the row renders it as "เหตุผลที่ระงับ: No reason" —
        // English boilerplate in a Thai UI. Give it something true instead.
        banReason: reason?.trim() || "ระงับโดยแอดมิน",
      },
      headers: await headers(),
    });
  } else {
    await auth.api.unbanUser({ body: { userId: id }, headers: await headers() });
  }
  refresh(id);
  return { ok: true };
}

/* ── Password ───────────────────────────────────────────────────────── */

export async function resetAccountPassword(
  id: string,
  newPassword: string
): Promise<AccountResult> {
  const g = await gate();
  if (!g.ok) return g;
  if (newPassword.length < MIN_PASSWORD)
    return {
      ok: false,
      error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`,
    };

  await auth.api.setUserPassword({
    body: { userId: id, newPassword },
    headers: await headers(),
  });
  refresh(id);
  return { ok: true };
}

/* ── LINE link ──────────────────────────────────────────────────────── */

/** Unbind LINE so /link can attach a different LINE account. */
export async function clearAccountLine(id: string): Promise<AccountResult> {
  const g = await gate();
  if (!g.ok) return g;
  await getDb().update(users).set({ lineUserId: null }).where(eq(users.id, id));
  refresh(id);
  return { ok: true };
}

/* ── Avatar ─────────────────────────────────────────────────────────── */

/** FormData because a File cannot cross a server-action boundary any other
    way. Storage + cleanup live in lib/repo/avatar.ts, shared with /team. */
export async function setAccountAvatar(
  id: string,
  fd: FormData
): Promise<AccountResult> {
  const g = await gate();
  if (!g.ok) return g;

  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, error: "ไม่พบไฟล์" };
  const res = await putAvatar(id, file);
  if (!res.ok) return res;
  refresh(id);
  return { ok: true };
}

export async function removeAccountAvatar(id: string): Promise<AccountResult> {
  const g = await gate();
  if (!g.ok) return g;
  const res = await clearAvatar(id);
  if (!res.ok) return res;
  refresh(id);
  return { ok: true };
}

/* ── Create ─────────────────────────────────────────────────────────── */

export interface NewAccount {
  name: string;
  nickname: string;
  email: string;
  password: string;
  role: string;
}

export async function createAccount(
  input: NewAccount
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const g = await gate();
  if (!g.ok) return g;

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const nickname = input.nickname.trim();
  if (!name) return { ok: false, error: "ใส่ชื่อที่แสดงก่อน" };
  if (!email) return { ok: false, error: "ใส่อีเมลก่อน" };
  if (input.password.length < MIN_PASSWORD)
    return {
      ok: false,
      error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`,
    };

  const roles = await allRoles();
  const role = roles.some((r) => r.id === input.role) ? input.role : "sales";

  const db = getDb();
  const [dup] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (dup) return { ok: false, error: `มีบัญชีอีเมล “${email}” อยู่แล้ว` };

  // Better Auth admin plugin, used for ONE thing: hashing the password the way
  // sign-in expects. The role is deliberately NOT passed.
  //
  // `role` here is a roles.id — our vocabulary, editable data in the roles
  // table. Better Auth's admin plugin validates the `role` in this body
  // against ITS OWN registry (the `roles` option in lib/auth/index.ts, which
  // holds "superadmin" and nothing else, because that is the only role its
  // account-management endpoints answer to) and throws BAD_REQUEST "not
  // allowed to set a non-existent role value" for anything else. Passing a
  // roles.id through here meant every ordinary account — เซลส์, ผู้จัดการ,
  // บัญชี — failed to create, and would fail again the day somebody adds a
  // custom role at /settings/roles.
  //
  // Widening that registry is not the fix: hasPermission() reads it, so
  // registering our roles there with admin grants would let any signed-in
  // user call POST /api/auth/admin/create-user. The two vocabularies stay
  // separate, exactly as role CHANGES already do (setAccountRole below, and
  // scripts/create-user.ts, both write users.role directly).
  let created;
  try {
    created = await auth.api.createUser({
      body: { email, password: input.password, name },
      headers: await headers(),
    });
  } catch (e) {
    // Anything Better Auth rejects belongs in the form, not in the app's error
    // boundary — a thrown server action replaces the whole tab and loses what
    // was typed.
    console.error("[settings] createUser failed:", e);
    return { ok: false, error: "สร้างบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  const id = created?.user?.id;
  if (!id) return { ok: false, error: "สร้างบัญชีไม่สำเร็จ" };

  // The account lands on the plugin's defaultRole; this is what actually
  // applies the chosen one. `role` was matched against the roles table above,
  // so it is never unvalidated input.
  //
  // nickname rides along rather than through createUser's `data`: the drizzle
  // adapter only maps fields declared in user.additionalFields and drops the
  // rest silently. It matters — the LINE bot resolves by nickname first.
  await db
    .update(users)
    .set(nickname ? { role, nickname } : { role })
    .where(eq(users.id, id));

  refresh(id);
  return { ok: true, id };
}
