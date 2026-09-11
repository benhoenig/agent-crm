"use client";

// Master–detail editor for the role matrix (Settings → สิทธิ์การใช้งาน).
// The right-hand editor auto-saves every change on blur/change through the
// plain-arg server actions — no save buttons, a subtle "บันทึกแล้ว ✓" flash.
// Field labels + hint lines mirror the JSDoc on lib/auth/roles.ts
// RolePermissions; scoping itself is enforced in the query layer.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { Button, Card, Field, Input, Pill, Select } from "@/components/ui";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import {
  PERM_TOGGLE_KEYS,
  type RolePermissions,
  type Scope,
} from "@/lib/auth/roles";
import { formatNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  addRole,
  deleteRole,
  updateRoleMeta,
  updateRolePerms,
} from "@/app/(app)/settings/roles/actions";

export interface RoleData {
  id: string;
  name: string;
  description: string;
  system: boolean;
  perms: RolePermissions;
  members: number;
}

export const SCOPE_LABEL: Record<Scope, string> = {
  none: "ไม่เห็นเลย",
  own: "ของตัวเอง",
  "own+zone": "ของตัวเอง + โซนที่ดูแล",
  all: "ทั้งหมด",
};

/** The scope/select rows — each with the hint line agreed in the redesign. */
const SCOPE_ROWS: {
  key: "listings" | "leads" | "deals";
  label: string;
  hint: string;
}[] = [
  { key: "listings", label: "ทรัพย์ (Listings)", hint: "แถวที่เห็นในรายการทรัพย์และการค้นหา" },
  { key: "leads", label: "ลูกค้า (Leads)", hint: "Lead ที่เห็นในไปป์ไลน์และรายการลูกค้า" },
  { key: "deals", label: "ดีล", hint: "ดีลที่เห็น — จำกัดตั้งแต่ระดับ query ไม่ใช่แค่ซ่อนปุ่ม" },
];

type BoolKey = (typeof PERM_TOGGLE_KEYS)[number];

const TOGGLE_GROUPS: {
  title: string;
  rows: { key: BoolKey; label: string; hint: string }[];
}[] = [
  {
    title: "งานขายประจำวัน",
    rows: [
      {
        key: "listingDirectory",
        label: "คลังทรัพย์ทั้งบริษัท",
        hint: "ค้นหาทรัพย์ของเซลส์ทุกคนเพื่อจับคู่ลูกค้า (/inventory) — ดูอย่างเดียว แก้ไขไม่ได้ และไม่เห็นข้อมูลติดต่อเจ้าของ",
      },
      {
        key: "leadDirectory",
        label: "Lead ทั้งบริษัท",
        hint: "ค้นหา Lead ของทุกคนในบริษัท (/lead-directory) — ดูอย่างเดียว แก้ไขและมอบหมายไม่ได้ · หน้า “ลูกค้า Lead” ยังเป็นสมุดงานของตัวเองเสมอ",
      },
      {
        key: "leadCreate",
        label: "เปิด Lead ใหม่",
        hint: "สร้าง Lead เข้าระบบได้ — งานของโต๊ะรับลูกค้า · เซลส์เห็นและทำงานกับ Lead ของตัวเองได้โดยไม่ต้องมีสิทธิ์นี้ และการปิดไว้คือสิ่งที่กันไม่ให้ Lead ถูกสร้างข้ามขั้นตอนเช็คซ้ำ",
      },
      {
        key: "intakeAssign",
        label: "มอบหมาย Lead",
        hint: "จ่าย Lead ที่เข้ามาใหม่ให้เซลส์แต่ละคน",
      },
      {
        key: "focusDirectory",
        label: "โฟกัสเจ้าของของคนอื่น",
        hint: "เปิดดูรายการโฟกัสเจ้าของของเซลส์คนอื่น (/owner-focus) — ทุกคนมีของตัวเองอยู่แล้ว สิทธิ์นี้คือการอ่านของคนอื่นเพื่อโค้ชงาน",
      },
      {
        key: "targetsSet",
        label: "ดูแลทีมขาย",
        hint: "เลือกเซลส์เข้าทีมตัวเอง และตั้งเป้ารายได้รายเดือน + เป้า KPI ให้แต่ละคน — เซลส์เห็นเป้าของตัวเองแต่แก้ไม่ได้ (ไม่รวมสิทธิ์แก้ประวัติพนักงาน)",
      },
      {
        key: "listingUpdateQueue",
        label: "งานซัพพอร์ตประกาศ",
        hint: "เข้าหน้างานซัพพอร์ตประกาศ — ทรัพย์รอโพสต์ + คำขอแก้ไข + งานอัปเดตพอร์ทัล",
      },
      {
        key: "aiParse",
        label: "AI อ่านข้อความ",
        hint: "วางข้อความให้ AI กรอกฟอร์มอัตโนมัติ — มีค่าใช้จ่ายต่อการอ่านหนึ่งครั้ง",
      },
    ],
  },
  {
    title: "การเงิน & ดีล",
    rows: [
      {
        key: "ledger",
        label: "สมุดบัญชี & งบกำไรขาดทุน",
        hint: "สมุดบัญชีเงินสดและ P&L ทั้งบริษัท (/ledger)",
      },
      {
        key: "viewAudit",
        label: "ประวัติการเข้าดูข้อมูล",
        hint: "ดูว่าใครเปิดอ่านโครงการและ Last Match ไปเท่าไหร่ (/view-audit) — ใช้จับพฤติกรรมผิดปกติ · เป็นข้อมูลของเพื่อนร่วมงาน ให้เฉพาะคนที่ต้องตรวจสอบจริง",
      },
      {
        key: "dealReview",
        label: "สอบทานดีล",
        hint: "ล็อก/เปิดดีลที่ปิดแล้ว — ดีลที่สอบทานแล้วถูกล็อกจนกว่าจะเปิดใหม่",
      },
      {
        key: "dealLegalPII",
        label: "ข้อมูลกฎหมายผู้ซื้อ/ผู้ขาย (PII)",
        hint: "ชื่อเต็ม ที่อยู่ เลขบัตรประชาชน บนดีล",
      },
    ],
  },
  {
    title: "ทีม & ระบบ",
    rows: [
      {
        key: "teamManage",
        label: "จัดการข้อมูลพนักงาน",
        hint: "ข้อมูล HR และการมอบหมายโซนของแต่ละคน",
      },
      {
        key: "leaveApprove",
        label: "อนุมัติการลา",
        hint: "เห็นและอนุมัติคำขอลาของทีม",
      },
      {
        key: "settings",
        label: "หน้าตั้งค่า",
        hint: "Master data · SLA · บทบาท · กลุ่ม LINE — หน้าตั้งค่าทั้งหมดนี้",
      },
    ],
  },
];

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-ink-3/35",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-5 pt-4 pb-1 text-[10px] font-semibold tracking-[0.14em] text-ink-3 uppercase">
      {title}
    </div>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="pt-0.5 text-xs leading-relaxed text-ink-3">{hint}</div>
      </div>
      {/* fixed-width control box — Select's base w-full fills it (cn() has no
          tailwind-merge, so overriding w-full via className doesn't work) */}
      <div className="flex w-52 shrink-0 justify-end">{children}</div>
    </div>
  );
}

export function RoleEditor({ role }: { role: RoleData }) {
  const router = useRouter();
  const locked = role.id === "superadmin"; // lockout insurance — display only

  /* Local mirror so a toggle flips instantly. Seeded from the server once and
     then OWNED BY THE CLIENT until the editor unmounts.

     There used to be a `useEffect(() => setP(role.perms), [role])` under this,
     to "sync back to the source of truth" after the action revalidated. It did
     the opposite. `role` is built as a fresh object literal by the page, so the
     effect re-fired on every render of the parent, and the payload that fired
     it is not necessarily newer than what is on screen: flip two switches in
     quick succession and the first toggle's revalidation — rendered before the
     second toggle had been written — arrives last and pushes the second switch
     back off. The click looked like it did nothing (Ben, 2026-09-11).

     Nothing is lost by dropping it. The page gives RoleEditor `key={role.id}`,
     so picking a different role remounts the component and re-seeds this state
     from the server anyway, and a failed save reverts explicitly in savePerms
     below. */
  const [p, setP] = React.useState(role.perms);

  const [saved, setSaved] = React.useState(false);
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  function flashSaved() {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSaved(true);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  }

  function savePerms(patch: Partial<RolePermissions>) {
    setP((prev) => ({ ...prev, ...patch }));
    setError(null);
    startTransition(async () => {
      const res = await updateRolePerms(role.id, patch);
      if (res.ok) flashSaved();
      else {
        setP(role.perms); // revert the optimistic flip
        setError(res.error);
      }
    });
  }

  function saveMeta(patch: { name?: string; description?: string }) {
    setError(null);
    startTransition(async () => {
      const res = await updateRoleMeta(role.id, patch);
      if (res.ok) flashSaved();
      else setError(res.error);
    });
  }

  return (
    <Card className="self-start">
      {/* header — name/description save on blur */}
      <div className="border-b border-line px-5 pt-4 pb-4">
        {locked ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{role.name}</div>
              <p className="pt-1 text-sm text-ink-2">{role.description}</p>
            </div>
            <Pill tone="accent">ล็อกถาวร — กันล็อกเอาต์</Pill>
          </div>
        ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <Field label="ชื่อบทบาท">
              <Input
                key={`${role.id}-name`}
                defaultValue={role.name}
                disabled={locked}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== role.name) saveMeta({ name: next });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </Field>
            <Field label="คำอธิบาย">
              <Input
                key={`${role.id}-desc`}
                defaultValue={role.description}
                disabled={locked}
                placeholder="บทบาทนี้มีไว้ทำอะไร…"
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== role.description) saveMeta({ description: next });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </Field>
          </div>
          <div className="flex h-9 shrink-0 items-center gap-2">
            {saved ? (
              <span className="flex items-center gap-1 text-xs text-good">
                <Check size={12} /> บันทึกแล้ว
              </span>
            ) : null}
            {role.system ? <Pill tone="muted">บทบาทหลัก</Pill> : null}
          </div>
        </div>
        )}
        {locked ? (
          <p className="pt-3 text-xs leading-relaxed text-ink-3">
            บทบาทแอดมินแก้ไขไม่ได้โดยตั้งใจ — เป็นประกันไม่ให้ล็อกทุกคนออกจากระบบ
            สิทธิ์ทั้งหมดด้านล่างเปิดถาวร
          </p>
        ) : null}
        {error ? <p className="pt-2 text-xs text-bad">{error}</p> : null}
      </div>

      <div className="divide-y divide-line">
        {/* data scopes */}
        <div className="pb-2">
          <SectionHeader title="ขอบเขตข้อมูลที่เห็น" />
          {SCOPE_ROWS.map((f) => (
            <SettingRow key={f.key} label={f.label} hint={f.hint}>
              <Select
                key={`${role.id}-${f.key}`}
                defaultValue={p[f.key]}
                disabled={locked}
                onChange={(e) =>
                  savePerms({ [f.key]: e.target.value as Scope })
                }
              >
                {(Object.keys(SCOPE_LABEL) as Scope[]).map((s) => (
                  <option key={s} value={s}>
                    {SCOPE_LABEL[s]}
                  </option>
                ))}
              </Select>
            </SettingRow>
          ))}
          <SettingRow
            label="ข้อมูลติดต่อ (สมุดผู้ติดต่อ)"
            hint="ชื่อ เบอร์โทร LINE ของเจ้าของทรัพย์และลูกค้า — เห็นทุกคน หรือเฉพาะคนที่ผูกกับทรัพย์/Lead ของตัวเอง"
          >
            <Select
              key={`${role.id}-ownerContacts`}
              defaultValue={p.ownerContacts}
              disabled={locked}
              onChange={(e) =>
                savePerms({
                  ownerContacts: e.target.value as "all" | "own-listings",
                })
              }
            >
              <option value="all">เห็นทุกคน</option>
              <option value="own-listings">เฉพาะงานของตัวเอง</option>
            </Select>
          </SettingRow>
          <SettingRow
            label="เป้าหมาย (Goals)"
            hint="เห็นเป้าหมายและผลงานของตัวเอง หรือของทั้งทีม"
          >
            <Select
              key={`${role.id}-goals`}
              defaultValue={p.goals}
              disabled={locked}
              onChange={(e) =>
                savePerms({ goals: e.target.value as "own" | "all" })
              }
            >
              <option value="own">ของตัวเอง</option>
              <option value="all">ทั้งทีม</option>
            </Select>
          </SettingRow>
          <SettingRow
            label="Last Match"
            hint="ราคาปิดจริงและ Persona ผู้ซื้อทั้งบริษัท — ข้อมูลตลาดที่ลอกออกไปได้ง่ายที่สุด · เซลส์ยังบันทึกได้เสมอ แต่จะเห็นเฉพาะที่ตัวเองบันทึก"
          >
            <Select
              key={`${role.id}-lastMatch`}
              defaultValue={p.lastMatch}
              disabled={locked}
              onChange={(e) =>
                savePerms({ lastMatch: e.target.value as "own" | "all" })
              }
            >
              <option value="own">เฉพาะที่ตัวเองบันทึก</option>
              <option value="all">ทั้งบริษัท</option>
            </Select>
          </SettingRow>
        </div>

        {/* toggle groups */}
        {TOGGLE_GROUPS.map((g) => (
          <div key={g.title} className="pb-2">
            <SectionHeader title={g.title} />
            {g.rows.map((f) => (
              <SettingRow key={f.key} label={f.label} hint={f.hint}>
                <Switch
                  checked={Boolean(p[f.key])}
                  disabled={locked}
                  label={f.label}
                  onChange={(next) => savePerms({ [f.key]: next })}
                />
              </SettingRow>
            ))}
          </div>
        ))}

        {/* danger zone — custom roles only */}
        {!role.system ? (
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="text-sm font-medium">ลบบทบาทนี้</div>
              <div className="pt-0.5 text-xs text-ink-3">
                {role.members > 0
                  ? `ยังมีสมาชิก ${formatNum(role.members)} คน — ย้ายบทบาทให้พวกเขาก่อนจึงลบได้`
                  : "ไม่มีสมาชิกใช้บทบาทนี้ — ลบได้"}
              </div>
            </div>
            {role.members > 0 ? (
              <Button variant="ghost" disabled className="text-bad opacity-50">
                ลบบทบาท
              </Button>
            ) : (
              <ConfirmDelete
                confirmLabel={`ลบ “${role.name}”?`}
                warning="สิทธิ์ที่ตั้งไว้ของบทบาทนี้หายถาวร (ไม่มีสมาชิกได้รับผลกระทบ)"
                actionLabel="ลบบทบาท"
                trigger={
                  <span className="inline-flex items-center rounded-ctl px-3 py-1.5 text-sm font-medium text-bad transition-colors hover:bg-bad-soft">
                    ลบบทบาท
                  </span>
                }
                triggerAriaLabel={`ลบบทบาท ${role.name}`}
                onConfirm={async () => {
                  const res = await deleteRole(role.id);
                  if (res.ok) router.push("/settings/roles");
                  else setError(res.error);
                }}
              />
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** Footer of the master list — add a custom role cloned from an existing
    one, then jump straight into its editor. */
export function AddRoleForm({
  roles,
}: {
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState("");
  const [cloneFrom, setCloneFrom] = React.useState("sales");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function add() {
    const name = draft.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const res = await addRole(name, cloneFrom);
      if (res.ok && res.id) {
        setDraft("");
        router.push(`/settings/roles?role=${res.id}`);
      } else if (!res.ok) setError(res.error);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      className="border-t border-line p-3"
    >
      <div className="space-y-2">
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          placeholder="เพิ่มบทบาทใหม่… (Enter)"
          aria-label="เพิ่มบทบาทใหม่"
        />
        <div className="flex items-center gap-2">
          <Select
            value={cloneFrom}
            onChange={(e) => setCloneFrom(e.target.value)}
            aria-label="คัดลอกสิทธิ์จาก"
            className="flex-1 text-xs"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                คัดลอก: {r.name}
              </option>
            ))}
          </Select>
          <Button
            type="submit"
            disabled={!draft.trim() || pending}
            className="shrink-0 px-3"
          >
            <Plus size={15} /> เพิ่ม
          </Button>
        </div>
      </div>
      {error ? <p className="pt-1.5 text-xs text-bad">{error}</p> : null}
    </form>
  );
}
