"use client";

// Inline editor for one option kind (Settings → รายการตัวเลือก).
// Rows are display-first: drag to reorder, click to expand and edit.
// Every change saves on blur/change through the plain-arg server actions —
// no per-row save buttons. Archiving confirms with the real usage impact.

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, GripVertical, Lock, Plus } from "lucide-react";
import { Button, Field, Input, Pill, Select, type Tone } from "@/components/ui";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { TonePicker } from "@/components/ui/TonePicker";
import { ROLE_LABEL_TH, type OptionRole } from "@/lib/options/kinds";
import { formatNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  addOption,
  archiveOption,
  reorderOptions,
  restoreOption,
  updateOptionFields,
  type OptionPatch,
} from "@/app/(app)/settings/options/actions";

export interface OptionItem {
  id: number;
  key: string;
  tone: string | null;
  role: string | null;
  section: string | null;
  linkedKey: string | null;
  /** action_category only — "owner" | "buyer" | null. Which record's timeline
      offers this kind (and, for the funnel, which half it counts in). */
  scope: string | null;
  system: boolean;
  usage: number;
}

const DOT_BG: Record<Tone, string> = {
  accent: "bg-accent",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  muted: "bg-ink-3",
};

export function OptionsManager({
  kind,
  roles,
  extra,
  active,
  archived,
  sections,
  linkedCategories,
}: {
  kind: string;
  roles: OptionRole[];
  extra?: "section" | "linkedCategory" | "activityScope";
  active: OptionItem[];
  archived: OptionItem[];
  /** P&L blocks — only rendered when extra === "section". */
  sections: { key: string; title: string }[];
  /** Active ledger_category keys — only rendered when extra === "linkedCategory". */
  linkedCategories: string[];
}) {
  /* Local mirror of the active rows so a drag reorders instantly.
   *
   * THE RESYNC IS GUARDED BY A SIGNATURE, and that guard is the fix for the
   * same bug 84f2941 removed from RolesManager. This used to be a bare
   * `useEffect(() => setRows(active), [active])`. `active` is built as a fresh
   * array by the page on every render, so the effect re-fired on EVERY parent
   * render — not only when the data had actually changed — and whatever it
   * pushed in was not necessarily newer than what was on screen. Drag a row,
   * and any unrelated re-render arriving before the reorder had been written
   * would snap it straight back. The drag looked like it did nothing.
   *
   * IT CANNOT SIMPLY BE DELETED the way RolesManager's could. That component
   * only ever edited fields of rows it already had, so remounting on
   * `key={role.id}` was enough. Here the list itself changes from the server:
   * เพิ่มตัวเลือก adds a row, archive and restore move rows between the two
   * lists, and with no resync at all none of those would appear until the page
   * was left and re-entered.
   *
   * So: resync only when the server's rows genuinely differ — ids and their
   * order. Adds, archives and completed reorders all change that string and
   * come through; a re-render carrying identical data does not, and an
   * in-flight drag survives it. Done during render rather than in an effect
   * (React's documented way to adjust state on a prop change), so the new
   * order never paints and then jumps.
   *
   * Field edits are untouched by any of this — the inputs are uncontrolled
   * (defaultValue) and keyed by row id, so a resync cannot eat what somebody
   * is typing.                                                            */
  const serverOrder = active.map((r) => r.id).join(",");
  const [rows, setRows] = React.useState(active);
  const [syncedOrder, setSyncedOrder] = React.useState(serverOrder);
  if (serverOrder !== syncedOrder) {
    setSyncedOrder(serverOrder);
    setRows(active);
  }

  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [savedId, setSavedId] = React.useState<number | null>(null);
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rowError, setRowError] = React.useState<{ id: number; msg: string } | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [, startTransition] = React.useTransition();

  function flashSaved(id: number) {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedId(id);
    savedTimer.current = setTimeout(() => setSavedId(null), 1600);
  }

  function save(id: number, patch: OptionPatch) {
    setRowError(null);
    startTransition(async () => {
      const res = await updateOptionFields(id, patch);
      if (res.ok) flashSaved(id);
      else setRowError({ id, msg: res.error });
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const from = rows.findIndex((r) => r.id === a.id);
    const to = rows.findIndex((r) => r.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(rows, from, to);
    setRows(next);
    startTransition(async () => {
      await reorderOptions(kind, next.map((r) => r.id));
    });
  }

  return (
    <div>
      {/* Explicit id: without one, dnd-kit derives the drag handles'
          aria-describedby from a module-level counter that starts over on the
          client, so SSR emits DndDescribedBy-0 and hydration expects -1 and
          React reports a mismatch on every options kind. */}
      <DndContext
        id="settings-options-sortable"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul className="px-3 py-2">
            {rows.map((row) => (
              <SortableRow
                key={row.id}
                row={row}
                expanded={expandedId === row.id}
                onToggle={() =>
                  setExpandedId((cur) => (cur === row.id ? null : row.id))
                }
                saved={savedId === row.id}
                error={rowError?.id === row.id ? rowError.msg : null}
                save={save}
                roles={roles}
                extra={extra}
                sections={sections}
                linkedCategories={linkedCategories}
              />
            ))}
            {rows.length === 0 ? (
              <li className="py-6 text-center text-sm text-ink-3">
                ยังไม่มีตัวเลือก
              </li>
            ) : null}
          </ul>
        </SortableContext>
      </DndContext>

      <AddRow kind={kind} />

      {archived.length > 0 ? (
        <div className="border-t border-line">
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className="flex w-full items-center justify-between px-5 py-2.5 text-xs text-ink-3 transition-colors hover:text-ink"
          >
            <span>
              ที่ซ่อนไว้ ({archived.length}) — ค่าเดิมในข้อมูลยังแสดงผล
              แต่ไม่ขึ้นให้เลือกใหม่
            </span>
            <ChevronDown
              size={14}
              className={cn("transition-transform", showArchived && "rotate-180")}
            />
          </button>
          {showArchived ? (
            <ul className="divide-y divide-line px-5 pb-3">
              {archived.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1 text-sm text-ink-2">{o.key}</span>
                  <span className="num text-xs text-ink-3">
                    ใช้อยู่ {formatNum(o.usage)} รายการ
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2.5 py-1 text-xs"
                    onClick={() =>
                      startTransition(async () => {
                        await restoreOption(o.id);
                      })
                    }
                  >
                    นำกลับมาใช้
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SortableRow({
  row,
  expanded,
  onToggle,
  saved,
  error,
  save,
  roles,
  extra,
  sections,
  linkedCategories,
}: {
  row: OptionItem;
  expanded: boolean;
  onToggle: () => void;
  saved: boolean;
  error: string | null;
  save: (id: number, patch: OptionPatch) => void;
  roles: OptionRole[];
  extra?: "section" | "linkedCategory" | "activityScope";
  sections: { key: string; title: string }[];
  linkedCategories: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const tone = (row.tone as Tone | null) ?? null;

  function saveKey(e: React.FocusEvent<HTMLInputElement>) {
    const next = e.target.value.trim();
    if (next && next !== row.key) save(row.id, { key: next });
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-ctl",
        isDragging && "relative z-10 bg-surface-2 shadow-card",
        expanded && "bg-surface-3/50"
      )}
    >
      {/* row at rest */}
      <div
        onClick={onToggle}
        className="flex cursor-pointer items-center gap-2 rounded-ctl px-1.5 py-2 transition-colors hover:bg-surface-3"
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label={`ลากเพื่อเรียงลำดับ ${row.key}`}
          className="cursor-grab touch-none rounded p-1 text-ink-3 transition-colors hover:text-ink active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>

        {tone ? (
          <span className={cn("size-2 shrink-0 rounded-full", DOT_BG[tone])} />
        ) : (
          <span className="size-2 shrink-0 rounded-full border border-ink-3" />
        )}
        <span className="text-sm font-medium">{row.key}</span>

        {row.role ? (
          <span className="hidden max-w-64 truncate text-xs text-ink-3 md:block">
            {ROLE_LABEL_TH[row.role as OptionRole] ?? row.role}
          </span>
        ) : null}

        <span className="num ml-auto shrink-0 text-xs text-ink-3">
          ใช้อยู่ {formatNum(row.usage)}
        </span>

        {saved ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-good">
            <Check size={12} /> บันทึกแล้ว
          </span>
        ) : null}

        {row.system ? (
          <span
            title="ค่าหลักของระบบ — ซ่อนไม่ได้ (มีพฤติกรรมที่แดชบอร์ด/SLA ใช้อยู่)"
            className="flex size-7 items-center justify-center text-ink-3"
          >
            <Lock size={13} />
          </span>
        ) : (
          <ConfirmDelete
            onConfirm={() => archiveOption(row.id)}
            confirmLabel={`ซ่อน “${row.key}”?`}
            actionLabel="ซ่อน"
            triggerAriaLabel={`ซ่อน ${row.key}`}
            warning={`ใช้อยู่ ${formatNum(row.usage)} รายการ — ค่าเดิมในข้อมูลยังแสดงผลตามปกติ แต่จะไม่ขึ้นในตัวเลือกให้กรอกใหม่ (นำกลับมาใช้ได้ทีหลัง)`}
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

      {/* expanded editor — saves on blur/change */}
      {expanded ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="grid gap-3 px-3 pt-1 pb-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field
            label="ชื่อ (ค่าที่เก็บในข้อมูล)"
            hint={
              error ? (
                <span className="text-bad">{error}</span>
              ) : (
                "เปลี่ยนชื่อแล้ว ข้อมูลเดิมทุกแถวถูกเปลี่ยนตาม"
              )
            }
          >
            <Input
              // keyed by identity, never by the value: keying on row.key
              // remounts the field the moment the rename round-trip lands,
              // throwing away anything typed in between (and, on a rejected
              // rename, the text the user still has to fix).
              key={row.id}
              defaultValue={row.key}
              onBlur={saveKey}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </Field>

          <Field label="สีที่แสดง">
            <div className="flex items-center gap-2.5">
              <TonePicker
                value={tone}
                onChange={(t) => save(row.id, { tone: t })}
              />
              <Pill tone={tone ?? "muted"}>{row.key}</Pill>
              {!tone ? (
                <span className="text-xs text-ink-3">(อัตโนมัติ)</span>
              ) : null}
            </div>
          </Field>

          {roles.length > 0 ? (
            <Field
              label="พฤติกรรมของระบบ"
              hint="แถวที่ติดพฤติกรรมถูกนับในแดชบอร์ด / SLA"
            >
              <Select
                // identity, not value — see the rename Input above
                key={row.id}
                defaultValue={row.role ?? ""}
                onChange={(e) =>
                  save(row.id, { role: e.target.value || null })
                }
              >
                <option value="">— ไม่มีพฤติกรรมพิเศษ —</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL_TH[r]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {extra === "section" ? (
            <Field label="บล็อกใน P&L" hint="หมวดนี้รวมยอดเข้าบล็อกไหนของงบกำไรขาดทุน">
              <Select
                // identity, not value — see the rename Input above
                key={row.id}
                defaultValue={row.section ?? ""}
                onChange={(e) =>
                  save(row.id, { section: e.target.value || null })
                }
              >
                <option value="">— ยังไม่กำหนด —</option>
                {sections.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {extra === "activityScope" ? (
            <Field
              label="ใช้กับ"
              hint="กำหนดว่าประเภทนี้จะให้เลือกได้ในประวัติของทรัพย์ หรือของลูกค้า — ที่ไม่ระบุจะไม่ขึ้นทั้งสองที่ (ใช้ได้เฉพาะในแผนงาน)"
            >
              <Select
                // identity, not value — see the rename Input above
                key={row.id}
                defaultValue={row.scope ?? ""}
                onChange={(e) => save(row.id, { scope: e.target.value || null })}
              >
                <option value="">— ไม่ระบุ (เฉพาะแผนงาน) —</option>
                <option value="owner">ทรัพย์ (งานฝั่งเจ้าของ)</option>
                <option value="buyer">ลูกค้า (งานฝั่งผู้ซื้อ)</option>
              </Select>
            </Field>
          ) : null}

          {extra === "linkedCategory" ? (
            <Field label="ลงบัญชีในหมวด" hint="ส่วนแบ่งของบทบาทนี้ลง P&L บรรทัดไหน">
              <Select
                // identity, not value — see the rename Input above
                key={row.id}
                defaultValue={row.linkedKey ?? ""}
                onChange={(e) =>
                  save(row.id, { linkedKey: e.target.value || null })
                }
              >
                <option value="">— ยังไม่กำหนด —</option>
                {linkedCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function AddRow({ kind }: { kind: string }) {
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function add() {
    const key = draft.trim();
    if (!key) return;
    setError(null);
    startTransition(async () => {
      const res = await addOption(kind, key);
      if (res.ok) setDraft("");
      else setError(res.error);
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
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          placeholder="เพิ่มตัวเลือกใหม่… (Enter)"
          aria-label="เพิ่มตัวเลือกใหม่"
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={!draft.trim() || pending}
          className="shrink-0 px-3.5"
        >
          <Plus size={15} /> เพิ่ม
        </Button>
      </div>
      {error ? <p className="pt-1.5 text-xs text-bad">{error}</p> : null}
    </form>
  );
}
