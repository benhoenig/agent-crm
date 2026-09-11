"use client";

// Inline editor for the zone master (Settings → โซน).
// Same shape as the options editor: rows are display-first, click to expand
// and edit, every field saves on blur — no ?edit= round-trip, no save buttons.
// Each row carries the two facts you need before touching a zone: what
// references it (ทรัพย์ · โปรเจกต์ · Last Match) and who covers it.

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, Lock, Plus } from "lucide-react";
import { Button, Field, Input, Pill } from "@/components/ui";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { formatNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  addZone,
  deleteZone,
  updateZoneFields,
  type ZonePatch,
} from "@/app/(app)/settings/zones/actions";

export interface ZoneItem {
  id: string;
  code: string;
  nameEng: string;
  nameThai: string | null;
  location: string | null;
  listings: number;
  projects: number;
  lastMatches: number;
  agents: { id: string; name: string }[];
}

/** "row" = not about a single input (delete refusals). */
export type ZoneErrorField = keyof ZonePatch | "row";

/** The editor sends one field per save, so the patch names the field. */
function patchField(patch: ZonePatch): ZoneErrorField {
  return (Object.keys(patch)[0] as ZoneErrorField) ?? "row";
}

function usageTotal(z: ZoneItem) {
  return z.listings + z.projects + z.lastMatches;
}

/** "ทรัพย์ 12 · โปรเจกต์ 3 · Last Match 5" — only the non-zero parts. */
function usageLine(z: ZoneItem): string {
  const parts: string[] = [];
  if (z.listings) parts.push(`ทรัพย์ ${formatNum(z.listings)}`);
  if (z.projects) parts.push(`โปรเจกต์ ${formatNum(z.projects)}`);
  if (z.lastMatches) parts.push(`Last Match ${formatNum(z.lastMatches)}`);
  return parts.length ? parts.join(" · ") : "ยังไม่มีข้อมูลในโซนนี้";
}

export function ZonesManager({ zones }: { zones: ZoneItem[] }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which FIELD the error belongs to, not just which row: a "ชื่อ (Eng)
  // ว่างไม่ได้" rendered under รหัสโซน points at the wrong input, and a delete
  // failure ("ยังมีทรัพย์ 12 รายการ") is not about any field at all.
  const [rowError, setRowError] = React.useState<{
    id: string;
    field: ZoneErrorField;
    msg: string;
  } | null>(null);
  const [q, setQ] = React.useState("");
  const [, startTransition] = React.useTransition();

  function flashSaved(id: string) {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedId(id);
    savedTimer.current = setTimeout(() => setSavedId(null), 1600);
  }

  function save(id: string, patch: ZonePatch) {
    setRowError(null);
    startTransition(async () => {
      const res = await updateZoneFields(id, patch);
      if (res.ok) flashSaved(id);
      else setRowError({ id, field: patchField(patch), msg: res.error });
    });
  }

  const needle = q.trim().toLowerCase();
  const rows = needle
    ? zones.filter((z) =>
        [z.code, z.nameEng, z.nameThai, z.location]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(needle))
      )
    : zones;

  return (
    <div>
      {zones.length > 8 ? (
        <div className="px-5 pb-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาโซน — รหัส ชื่อ หรือทำเล"
            aria-label="ค้นหาโซน"
          />
        </div>
      ) : null}

      <ul className="px-3 py-2">
        {rows.map((z) => (
          <ZoneRow
            key={z.id}
            zone={z}
            expanded={expandedId === z.id}
            onToggle={() => setExpandedId((cur) => (cur === z.id ? null : z.id))}
            saved={savedId === z.id}
            error={rowError?.id === z.id ? rowError : null}
            onError={(msg) => setRowError({ id: z.id, field: "row", msg })}
            save={save}
          />
        ))}
        {rows.length === 0 ? (
          <li className="py-6 text-center text-sm text-ink-3">
            {zones.length === 0 ? "ยังไม่มีโซน" : `ไม่พบโซนที่ตรงกับ “${q}”`}
          </li>
        ) : null}
      </ul>

      <AddZoneRow onAdded={(id) => setExpandedId(id)} />
    </div>
  );
}

function ZoneRow({
  zone,
  expanded,
  onToggle,
  saved,
  error,
  onError,
  save,
}: {
  zone: ZoneItem;
  expanded: boolean;
  onToggle: () => void;
  saved: boolean;
  error: { field: ZoneErrorField; msg: string } | null;
  onError: (msg: string) => void;
  save: (id: string, patch: ZonePatch) => void;
}) {
  /** The error hint for one input — nothing if the error is another field's. */
  const errFor = (f: ZoneErrorField) =>
    error?.field === f ? <span className="text-bad">{error.msg}</span> : null;
  const used = usageTotal(zone);
  const shownAgents = zone.agents.slice(0, 3);
  // Second line: whatever isn't already the title. Empty rather than a
  // placeholder — 70 rows of "ยังไม่ได้ระบุทำเล" is noise, not information.
  const sub = [zone.nameThai ? zone.nameEng : null, zone.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={cn("rounded-ctl", expanded && "bg-surface-3/50")}>
      {/* row at rest */}
      <div
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-3 rounded-ctl px-2.5 py-2.5 transition-colors hover:bg-surface-3"
      >
        <span className="num w-20 shrink-0 truncate text-xs text-ink-2">
          {zone.code}
        </span>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {zone.nameThai ?? zone.nameEng}
          </div>
          {sub ? (
            <div className="truncate pt-0.5 text-xs text-ink-3">{sub}</div>
          ) : null}
        </div>

        <span className="num hidden shrink-0 text-xs text-ink-3 md:block">
          ทรัพย์ {formatNum(zone.listings)}
        </span>

        {shownAgents.length > 0 ? (
          <span className="hidden shrink-0 items-center gap-1 lg:flex">
            {shownAgents.map((a) => (
              <Pill key={a.id} tone="muted">
                {a.name}
              </Pill>
            ))}
            {zone.agents.length > shownAgents.length ? (
              <span className="num text-xs text-ink-3">
                +{zone.agents.length - shownAgents.length}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="hidden shrink-0 text-xs text-ink-3 lg:block">
            ยังไม่มีผู้ดูแล
          </span>
        )}

        {saved ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-good">
            <Check size={12} /> บันทึกแล้ว
          </span>
        ) : null}

        {used > 0 ? (
          <span
            title={`ลบไม่ได้ — ยังมี ${usageLine(zone)} อยู่ในโซนนี้`}
            className="flex size-7 items-center justify-center text-ink-3"
          >
            <Lock size={13} />
          </span>
        ) : (
          <ConfirmDelete
            onConfirm={async () => {
              const res = await deleteZone(zone.id);
              if (!res.ok) onError(res.error);
            }}
            confirmLabel={`ลบโซน “${zone.nameThai ?? zone.nameEng}”?`}
            actionLabel="ลบโซน"
            triggerAriaLabel={`ลบโซน ${zone.code}`}
            warning={
              zone.agents.length > 0
                ? `ไม่มีทรัพย์ โปรเจกต์ หรือ Last Match อ้างถึงโซนนี้ — แต่ผู้ดูแล ${formatNum(
                    zone.agents.length
                  )} คนจะถูกถอดออกจากโซนนี้ด้วย`
                : "ไม่มีข้อมูลใดอ้างถึงโซนนี้ — ลบแล้วหายถาวร"
            }
          />
        )}

        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-ink-3 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </div>

      {/* Delete refusals are not about any input, and the delete button sits on
          the collapsed header — so this has to live outside the editor below,
          which only renders when the row is open. */}
      {error?.field === "row" ? (
        <p className="px-3 pb-2 text-xs text-bad">{error.msg}</p>
      ) : null}

      {/* expanded editor — saves on blur */}
      {expanded ? (
        <div onClick={(e) => e.stopPropagation()} className="px-3 pt-1 pb-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="รหัสโซน" hint={errFor("code") ?? "เช่น SAT-001"}>
              <Input
                key={`${zone.id}-code`}
                defaultValue={zone.code}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== zone.code) save(zone.id, { code: next });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </Field>
            <Field label="ชื่อ (Eng)" hint={errFor("nameEng")}>
              <Input
                key={`${zone.id}-eng`}
                defaultValue={zone.nameEng}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== zone.nameEng)
                    save(zone.id, { nameEng: next });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </Field>
            <Field label="ชื่อ (ไทย)" hint={errFor("nameThai")}>
              <Input
                key={`${zone.id}-thai`}
                defaultValue={zone.nameThai ?? ""}
                placeholder="ชื่อที่ทีมใช้เรียก"
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== (zone.nameThai ?? ""))
                    save(zone.id, { nameThai: next });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </Field>
            <Field label="ทำเล / รายละเอียด" hint={errFor("location")}>
              <Input
                key={`${zone.id}-loc`}
                defaultValue={zone.location ?? ""}
                placeholder="ถนน / BTS / ขอบเขตโซน"
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== (zone.location ?? ""))
                    save(zone.id, { location: next });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs text-ink-3">
            <span>ข้อมูลในโซน: {usageLine(zone)}</span>
            <span>
              ผู้ดูแล:{" "}
              {zone.agents.length
                ? zone.agents.map((a) => a.name).join(", ")
                : "ยังไม่มี"}{" "}
              —{" "}
              <Link href="/team" className="text-accent-text hover:underline">
                มอบหมายโซนที่หน้าทีม
              </Link>
            </span>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function AddZoneRow({ onAdded }: { onAdded: (id: string) => void }) {
  const [code, setCode] = React.useState("");
  const [nameEng, setNameEng] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function add() {
    if (!code.trim() || !nameEng.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addZone(code, nameEng);
      if (res.ok) {
        setCode("");
        setNameEng("");
        onAdded(res.id); // open the new row so the rest can be filled in
      } else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      className="border-t border-line px-5 py-3.5"
    >
      <div className="flex items-center gap-2">
        {/* fixed-width box — Input's base w-full fills it (cn() has no
            tailwind-merge, so a w-40 className would not override w-full) */}
        <div className="w-40 shrink-0">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            placeholder="รหัส เช่น SAT-001"
            aria-label="รหัสโซนใหม่"
            className="num"
          />
        </div>
        <Input
          value={nameEng}
          onChange={(e) => {
            setNameEng(e.target.value);
            setError(null);
          }}
          placeholder="ชื่อโซน (Eng)… (Enter)"
          aria-label="ชื่อโซนใหม่"
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={!code.trim() || !nameEng.trim() || pending}
          className="shrink-0 px-3.5"
        >
          <Plus size={15} /> เพิ่ม
        </Button>
      </div>
      {error ? <p className="pt-1.5 text-xs text-bad">{error}</p> : null}
    </form>
  );
}
