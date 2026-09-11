"use client";

// Inline editor for user accounts (Settings → บัญชีผู้ใช้).
//
// The old tab was a create-form plus a read-only table whose own footer
// admitted what it could not do: "จัดการสิทธิ์ รีเซ็ตรหัสผ่าน และระงับบัญชี
// ได้จากหน้าโปรไฟล์พนักงานแต่ละคน". Eleven accounts, eleven page visits.
//
// Two things this adds beyond moving the controls here:
//
//  1. AVATARS. The delivery route has always understood avatars/{id}.{ext}
//     and the only way to set one was a member's own profile page — so the
//     team directory is a wall of initials. Uploading here writes through
//     lib/repo/avatar.ts, the same path /team uses.
//
//  2. WHAT SUSPENDING WOULD STRAND. One account owns 424 listings, another
//     owns nothing, and the old table showed neither. Every row carries its
//     counts, and the suspend confirmation repeats them — because "ระงับ"
//     on those two rows are not the same act.

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ImageOff,
  Loader2,
  Lock,
  Plus,
  Upload,
} from "lucide-react";
import { Button, Field, Input, Pill, Select, type Tone } from "@/components/ui";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate, formatNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import { AVATAR_ACCEPT, AVATAR_TYPES_TH } from "@/lib/avatar";
import type { AccountRow } from "@/lib/repo/team";
import {
  clearAccountLine,
  createAccount,
  removeAccountAvatar,
  resetAccountPassword,
  setAccountAvatar,
  setAccountBanned,
  setAccountEmploymentStatus,
  setAccountRole,
  setAccountExtraRoles,
  updateAccountFields,
  type AccountPatch,
} from "@/app/(app)/settings/accounts-actions";

export interface RoleOption {
  id: string;
  name: string;
}

export interface StatusOption {
  key: string;
  tone: Tone | null;
}

/** HR says gone, the login still works. The one combination worth shouting
    about: it is a live credential for someone who has left, and nothing in
    the app put those two facts next to each other before. */
const isStranded = (a: AccountRow, departed: string[]) =>
  !!a.employmentStatus && departed.includes(a.employmentStatus) && !a.banned;

/** "ทรัพย์ 424 · Lead 64 · ดีล 3" — only the non-zero parts. */
function ownedLine(a: AccountRow): string {
  const parts: string[] = [];
  if (a.listings) parts.push(`ทรัพย์ ${formatNum(a.listings)}`);
  if (a.leads) parts.push(`Lead ${formatNum(a.leads)}`);
  if (a.deals) parts.push(`ดีล ${formatNum(a.deals)}`);
  return parts.join(" · ");
}

const ownsAnything = (a: AccountRow) => a.listings + a.leads + a.deals > 0;

export function AccountsManager({
  accounts,
  roles,
  statuses,
  departed,
  viewerId,
  canManage,
}: {
  accounts: AccountRow[];
  roles: RoleOption[];
  /** employment_status options, in catalog order. */
  statuses: StatusOption[];
  /** Those tagged with the `departed` role. */
  departed: string[];
  viewerId: string;
  /** p.teamManage. Without it the tab is a directory, not an editor. */
  canManage: boolean;
}) {
  const stranded = accounts.filter((a) => isStranded(a, departed));
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rowError, setRowError] = React.useState<{
    id: string;
    field: string;
    msg: string;
  } | null>(null);
  const [, startTransition] = React.useTransition();

  React.useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  function flashSaved(id: string) {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedId(id);
    savedTimer.current = setTimeout(() => setSavedId(null), 1600);
  }

  function save(id: string, patch: AccountPatch) {
    setRowError(null);
    startTransition(async () => {
      const res = await updateAccountFields(id, patch);
      if (res.ok) flashSaved(id);
      else
        setRowError({
          id,
          field: Object.keys(patch)[0] ?? "row",
          msg: res.error,
        });
    });
  }

  return (
    <div>
      {stranded.length > 0 ? (
        <div className="mx-3 mt-2 flex items-start gap-2.5 rounded-ctl bg-warn-soft px-3.5 py-3 text-xs leading-relaxed text-warn">
          <AlertTriangle size={15} className="mt-px shrink-0" />
          <span>
            <b>
              {stranded.map((a) => a.nickname ?? a.name).join(" · ")}
            </b>{" "}
            — ฝ่ายบุคคลบันทึกว่าออกแล้ว แต่บัญชียัง<b>เข้าระบบได้อยู่</b>{" "}
            ถ้าออกจริงให้กด “ระงับบัญชี” ในแถวนั้น
            (ถ้ายังทำงานอยู่ ให้แก้สถานะพนักงานแทน)
          </span>
        </div>
      ) : null}

      <ul className="divide-y divide-line px-3 py-2">
        {accounts.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            roles={roles}
            statuses={statuses}
            departed={departed}
            isSelf={a.id === viewerId}
            canManage={canManage}
            expanded={expandedId === a.id}
            onToggle={() =>
              setExpandedId((cur) => (cur === a.id ? null : a.id))
            }
            saved={savedId === a.id}
            error={rowError?.id === a.id ? rowError : null}
            onError={(field, msg) => setRowError({ id: a.id, field, msg })}
            onSaved={() => flashSaved(a.id)}
            save={save}
          />
        ))}
      </ul>

      {canManage ? <AddAccountRow roles={roles} onAdded={setExpandedId} /> : null}
    </div>
  );
}

function AccountCard({
  account: a,
  roles,
  statuses,
  departed,
  isSelf,
  canManage,
  expanded,
  onToggle,
  saved,
  error,
  onError,
  onSaved,
  save,
}: {
  account: AccountRow;
  roles: RoleOption[];
  statuses: StatusOption[];
  departed: string[];
  isSelf: boolean;
  canManage: boolean;
  expanded: boolean;
  onToggle: () => void;
  saved: boolean;
  error: { field: string; msg: string } | null;
  onError: (field: string, msg: string) => void;
  onSaved: () => void;
  save: (id: string, patch: AccountPatch) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const statusRef = React.useRef<HTMLSelectElement>(null);
  /** A departed status revokes live sessions, so it asks before saving —
      every other field on this tab saves straight from the control. */
  const [pendingStatus, setPendingStatus] = React.useState<string | null>(null);
  const errFor = (f: string) =>
    error?.field === f ? <span className="text-bad">{error.msg}</span> : null;

  const roleName = roles.find((r) => r.id === a.role)?.name ?? a.role;
  const owned = ownedLine(a);

  function run(field: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) onSaved();
      else onError(field, res.error ?? "ไม่สำเร็จ");
    });
  }

  function chooseStatus(raw: string) {
    const next = raw || null;
    if (next && departed.includes(next) && !a.banned) {
      setPendingStatus(next); // hold it — confirm below
      return;
    }
    commitStatus(next);
  }

  function commitStatus(next: string | null) {
    setPendingStatus(null);
    startTransition(async () => {
      const res = await setAccountEmploymentStatus(a.id, next);
      if (res.ok) onSaved();
      else {
        onError("employmentStatus", res.error);
        if (statusRef.current)
          statusRef.current.value = a.employmentStatus ?? "";
      }
    });
  }

  function cancelStatus() {
    setPendingStatus(null);
    if (statusRef.current) statusRef.current.value = a.employmentStatus ?? "";
  }

  function pickAvatar(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await setAccountAvatar(a.id, fd);
      setUploading(false);
      if (res.ok) onSaved();
      else onError("avatar", res.error);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <li className={cn("rounded-ctl", expanded && "bg-surface-3/50")}>
      {/* row at rest */}
      <div
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-3 rounded-ctl px-1.5 py-2.5 transition-colors hover:bg-surface-3"
      >
        <Avatar image={a.image} name={a.nickname ?? a.name} />

        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {a.name}
            {a.nickname ? (
              <span className="pl-1.5 text-ink-3">({a.nickname})</span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-ink-3">{a.email}</span>
        </span>

        <span className="ml-auto flex shrink-0 items-center gap-2">
          {owned ? (
            <span className="num hidden text-xs text-ink-3 lg:block">
              {owned}
            </span>
          ) : null}
          <Pill tone={a.role === "superadmin" ? "accent" : "muted"}>{roleName}</Pill>
          {a.employmentStatus && departed.includes(a.employmentStatus) ? (
            <Pill tone={isStranded(a, departed) ? "warn" : "muted"}>
              {a.employmentStatus}
            </Pill>
          ) : null}
          {a.lineUserId ? (
            <Pill tone="good">LINE</Pill>
          ) : (
            <span className="hidden text-xs text-ink-3 sm:block">ไม่มี LINE</span>
          )}
          {a.banned ? <Pill tone="bad">ระงับอยู่</Pill> : null}
          {saved ? (
            <span className="flex items-center gap-1 text-xs text-good">
              <Check size={12} /> บันทึกแล้ว
            </span>
          ) : null}
          <ChevronDown
            size={14}
            className={cn(
              "text-ink-3 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </span>
      </div>

      {error && error.field === "row" ? (
        <p className="px-3 pb-2 text-xs text-bad">{error.msg}</p>
      ) : null}

      {expanded ? (
        <div onClick={(e) => e.stopPropagation()} className="px-3 pt-1 pb-4">
          {!canManage ? (
            <p className="rounded-ctl bg-surface-2 px-3 py-2 text-xs text-ink-3">
              ดูได้อย่างเดียว — ต้องมีสิทธิ์ ‘จัดการพนักงาน’ ถึงจะแก้บัญชีได้
            </p>
          ) : (
            <>
              {/* ── avatar ───────────────────────────────────────────── */}
              <div className="flex items-center gap-4 pb-4">
                <Avatar
                  image={a.image}
                  name={a.nickname ?? a.name}
                  size="size-16 text-xl"
                />
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept={AVATAR_ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) pickAvatar(f);
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs"
                      disabled={uploading || pending}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      {a.image ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                    </Button>

                    {a.image ? (
                      <ConfirmDelete
                        onConfirm={() =>
                          run("avatar", () => removeAccountAvatar(a.id))
                        }
                        actionLabel="ลบรูป"
                        confirmLabel={`ลบรูปโปรไฟล์ของ “${a.nickname ?? a.name}”?`}
                        warning="กลับไปแสดงเป็นตัวอักษรย่อ อัปโหลดใหม่ได้ทุกเมื่อ"
                        triggerAriaLabel={`ลบรูปโปรไฟล์ของ ${a.name}`}
                        trigger={
                          <span className="flex items-center gap-1.5 rounded-ctl px-2.5 py-1.5 text-xs text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad">
                            <ImageOff size={13} /> ลบรูป
                          </span>
                        }
                      />
                    ) : null}
                  </div>
                  <p className="text-xs text-ink-3">
                    {AVATAR_TYPES_TH} · ไม่เกิน 5 MB · รูปสี่เหลี่ยมจัตุรัสจะสวยที่สุด
                  </p>
                  {errFor("avatar") ? (
                    <p className="text-xs">{errFor("avatar")}</p>
                  ) : null}
                </div>
              </div>

              {/* ── identity ─────────────────────────────────────────── */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="ชื่อที่แสดง" hint={errFor("name")}>
                  <Input
                    key={a.id}
                    defaultValue={a.name}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== a.name) save(a.id, { name: next });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                </Field>

                <Field
                  label="ชื่อเล่น"
                  hint={errFor("nickname") ?? "บอท LINE เรียกด้วยชื่อนี้ เช่น /doplan"}
                >
                  <Input
                    key={a.id}
                    defaultValue={a.nickname ?? ""}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next !== (a.nickname ?? ""))
                        save(a.id, { nickname: next });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                </Field>

                <Field label="อีเมล (ใช้เข้าระบบ)" hint="เปลี่ยนไม่ได้">
                  <Input defaultValue={a.email} disabled readOnly />
                </Field>

                <Field
                  label="บทบาทหลัก"
                  hint={
                    errFor("role") ??
                    (isSelf ? "เปลี่ยนสิทธิ์ของตัวเองไม่ได้" : undefined)
                  }
                >
                  <Select
                    key={a.id}
                    defaultValue={a.role}
                    disabled={isSelf || pending}
                    onChange={(e) =>
                      run("role", () => setAccountRole(a.id, e.target.value))
                    }
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* Extra roles. Someone can be เซลส์ AND ผู้จัดการ at once — Do
                  and Stang run the team and carry 300+ listings each — and
                  permissions merge MOST PERMISSIVELY across everything held,
                  so ticking a box can only ever add access. */}
              <Field
                label="บทบาทเพิ่มเติม"
                hint={
                  errFor("extraRoles") ??
                  "สิทธิ์จะรวมกันแบบกว้างที่สุดจากทุกบทบาทที่ถืออยู่"
                }
              >
                <div className="flex flex-wrap gap-3 pt-1">
                  {roles
                    .filter((r) => r.id !== a.role)
                    .map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-1.5 text-sm text-ink-2"
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 accent-(--accent)"
                          defaultChecked={a.extraRoles.includes(r.id)}
                          disabled={isSelf || pending}
                          onChange={(e) => {
                            const next = e.currentTarget.checked
                              ? [...a.extraRoles, r.id]
                              : a.extraRoles.filter((x) => x !== r.id);
                            run("extraRoles", () =>
                              setAccountExtraRoles(a.id, next)
                            );
                          }}
                        />
                        {r.name}
                      </label>
                    ))}
                </div>
              </Field>

              {/* HR record. Sits next to สิทธิ์ because the pair is the
                  question an admin is actually asking: is this person still
                  here, and can they still get in. */}
              <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="สถานะพนักงาน"
                  hint={
                    errFor("employmentStatus") ??
                    (isStranded(a, departed) ? (
                      <span className="text-warn">
                        ออกแล้วแต่ยังเข้าระบบได้ — ระงับบัญชีด้านล่าง
                      </span>
                    ) : (
                      "ตั้งเป็นสถานะที่ ‘ออกแล้ว’ = ระงับบัญชีให้ทันที"
                    ))
                  }
                >
                  <Select
                    key={a.id}
                    ref={statusRef}
                    defaultValue={a.employmentStatus ?? ""}
                    disabled={pending}
                    onChange={(e) => chooseStatus(e.target.value)}
                  >
                    <option value="">— ยังไม่ระบุ —</option>
                    {statuses.map((st) => (
                      <option key={st.key} value={st.key}>
                        {st.key}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {pendingStatus ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-ctl bg-warn-soft px-3.5 py-3 text-xs leading-relaxed text-warn">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span className="flex-1">
                    ตั้งเป็น “{pendingStatus}” จะ<b>ระงับบัญชีทันที</b> —{" "}
                    {a.nickname ?? a.name} จะถูกตัดออกจากระบบทันทีที่กดยืนยัน
                    {ownsAnything(a) ? <> และ <b>{owned}</b> ยังอยู่ในชื่อเขา</> : null}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                    disabled={pending}
                    onClick={() => commitStatus(pendingStatus)}
                  >
                    ยืนยัน — ระงับด้วย
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3 py-1.5 text-xs"
                    disabled={pending}
                    onClick={cancelStatus}
                  >
                    ยกเลิก
                  </Button>
                </div>
              ) : null}

              <PasswordRow
                account={a}
                onDone={onSaved}
                onError={(m) => onError("password", m)}
                error={errFor("password")}
              />

              {/* ── account state ────────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 text-xs text-ink-3">
                <span>
                  สร้างเมื่อ{" "}
                  <span className="num">{formatDate(a.createdAt)}</span>
                </span>
                <span>งานที่ถืออยู่: {owned || "ยังไม่มี"}</span>
                <Link
                  href={`/team/${a.id}`}
                  className="text-accent-text hover:underline"
                >
                  โปรไฟล์ HR เต็ม
                </Link>

                <span className="ml-auto flex items-center gap-2">
                  {a.lineUserId ? (
                    <ConfirmDelete
                      onConfirm={() =>
                        run("row", () => clearAccountLine(a.id))
                      }
                      actionLabel="ถอด LINE"
                      confirmLabel={`ถอดการเชื่อม LINE ของ “${a.nickname ?? a.name}”?`}
                      warning="คนนี้จะไม่ได้รับแจ้งเตือนทาง LINE จนกว่าจะพิมพ์ /link ผูกใหม่"
                      triggerAriaLabel={`ถอด LINE ของ ${a.name}`}
                      trigger={
                        <span className="rounded-ctl px-2.5 py-1.5 text-xs text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad">
                          ถอด LINE
                        </span>
                      }
                    />
                  ) : null}

                  {isSelf ? (
                    <span
                      title="ระงับบัญชีตัวเองไม่ได้"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-ink-3"
                    >
                      <Lock size={13} /> บัญชีของคุณเอง
                    </span>
                  ) : a.banned ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      disabled={pending}
                      onClick={() =>
                        run("row", () => setAccountBanned(a.id, false))
                      }
                    >
                      คืนสถานะใช้งาน
                    </Button>
                  ) : (
                    <ConfirmDelete
                      onConfirm={() =>
                        run("row", () => setAccountBanned(a.id, true))
                      }
                      actionLabel="ระงับบัญชี"
                      confirmLabel={`ระงับบัญชี “${a.nickname ?? a.name}”?`}
                      warning={
                        ownsAnything(a) ? (
                          <>
                            เข้าระบบไม่ได้ทันทีและเซสชันที่เปิดอยู่ถูกตัด — แต่{" "}
                            <b>{owned}</b> ยังอยู่ในชื่อเขา
                            ไม่ได้ย้ายให้ใครโดยอัตโนมัติ ย้ายงานก่อนถ้าจำเป็น
                          </>
                        ) : (
                          "เข้าระบบไม่ได้ทันทีและเซสชันที่เปิดอยู่ถูกตัด — ยังไม่มีงานค้างในชื่อเขา คืนสถานะได้ทีหลัง"
                        )
                      }
                      triggerAriaLabel={`ระงับบัญชี ${a.name}`}
                      trigger={
                        <span className="rounded-ctl px-2.5 py-1.5 text-xs text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad">
                          ระงับบัญชี
                        </span>
                      }
                    />
                  )}
                </span>
              </div>

              {a.banned && a.banReason ? (
                <p className="pt-2 text-xs text-warn">
                  เหตุผลที่ระงับ: {a.banReason}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** Password reset is the one control here that is NOT an auto-save: a
    half-typed password must never reach the server on blur. */
function PasswordRow({
  account,
  onDone,
  onError,
  error,
}: {
  account: AccountRow;
  onDone: () => void;
  onError: (msg: string) => void;
  error: React.ReactNode;
}) {
  const [value, setValue] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    if (value.length < 8) {
      onError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }
    startTransition(async () => {
      const res = await resetAccountPassword(account.id, value);
      if (res.ok) {
        setValue("");
        onDone();
      } else onError(res.error);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-wrap items-end gap-2 pt-3"
    >
      <Field
        label="ตั้งรหัสผ่านใหม่"
        hint={error ?? "แจ้งรหัสนี้ให้เจ้าตัวโดยตรง แล้วให้เปลี่ยนเองภายหลัง"}
        className="min-w-56 flex-1"
      >
        <Input
          type="text"
          value={value}
          autoComplete="new-password"
          placeholder="อย่างน้อย 8 ตัวอักษร"
          aria-label={`ตั้งรหัสผ่านใหม่ให้ ${account.name}`}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        className="px-3 py-2 text-xs"
        disabled={pending || value.length < 8}
      >
        {pending ? "กำลังตั้ง…" : "ตั้งรหัสผ่าน"}
      </Button>
    </form>
  );
}

function AddAccountRow({
  roles,
  onAdded,
}: {
  roles: RoleOption[];
  onAdded: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    nickname: "",
    email: "",
    password: "",
    role: "sales",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await createAccount(form);
      if (res.ok) {
        setForm({ name: "", nickname: "", email: "", password: "", role: "sales" });
        setOpen(false);
        onAdded(res.id); // open the new row so the avatar can go straight on
      } else setError(res.error);
    });
  }

  if (!open) {
    return (
      <div className="border-t border-line px-5 py-3">
        <Button
          type="button"
          variant="ghost"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
          onClick={() => setOpen(true)}
        >
          <Plus size={14} /> เพิ่มบัญชีผู้ใช้
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      className="border-t border-line px-5 py-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="ชื่อที่แสดง *">
          <Input
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="ชื่อเล่น" hint="ใช้ในกลุ่ม LINE">
          <Input
            value={form.nickname}
            onChange={(e) => set("nickname")(e.target.value)}
          />
        </Field>
        <Field label="อีเมล *">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
          />
        </Field>
        <Field label="รหัสผ่านชั่วคราว *">
          <Input
            type="text"
            value={form.password}
            autoComplete="new-password"
            placeholder="อย่างน้อย 8 ตัว"
            onChange={(e) => set("password")(e.target.value)}
          />
        </Field>
        <Field label="สิทธิ์">
          <Select
            value={form.role}
            onChange={(e) => set("role")(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {error ? <p className="pt-2 text-xs text-bad">{error}</p> : null}

      <div className="flex items-center gap-2 pt-3">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังสร้าง…" : "สร้างบัญชี"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="px-3 py-2 text-xs"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          ยกเลิก
        </Button>
        <span className="text-xs text-ink-3">
          แจ้งรหัสผ่านชั่วคราวให้เจ้าตัวโดยตรง แล้วให้เปลี่ยนเองที่หน้าโปรไฟล์
        </span>
      </div>
    </form>
  );
}
