"use client";

/* The task editor, as a bottom sheet. ONE component backs three jobs — add a
   task, edit an instance, schedule a backlog item — because they differ only
   in which fields are shown, and three near-identical forms would drift.

   Ported from Solo Gang's TaskDetailSheet. Two things dropped on the way:
     - the goal picker. Klaichan's เป้าหมาย page does not exist yet (lib/nav
       marks it `soon`), and a picker that links to nothing is a promise.
     - the share toggle on the recap. There is no team feed here to share to.

   MOBILE. No autofocus, deliberately: it pops the keyboard the instant the
   sheet opens, and on iOS a focused sub-16px field zooms the whole page.
   Inputs are 16px (`text-base`) for the same reason — a tap must never zoom. */

import { useEffect, useState } from "react";
import { X, Trash2, Repeat, Clock, Calendar } from "lucide-react";
import { taskToneVar, type TaskType } from "@/lib/plan";
import { bkkToday } from "@/lib/format";
import { RECUR_LABEL, RECUR_FREQS, WEEKDAY_LABELS, WEEKDAY_PICKER_ORDER, type RecurFreq } from "@/lib/plan";

export interface SheetValues {
  title: string;
  notes: string;
  kind: string | null;
  /** options "action_category" — set it and ticking the task logs the
      activity (0019). Null on most tasks; "จัดโต๊ะ" is not a sales activity. */
  actionCategory: string | null;
  /** How many you mean to do (0026). Empty string = no number applies, which
      is not 0 — ticking a task with no target logs no count and asks nothing. */
  targetQuantity: string;
  date: string;
  startTime: string;
  endTime: string;
  repeat: { freq: RecurFreq; weekdays: string; dayOfMonth: number | null } | null;
}

export interface SheetInitial {
  title?: string;
  notes?: string | null;
  kind?: string | null;
  actionCategory?: string | null;
  targetQuantity?: number | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

export function TaskDetailSheet({
  open, onClose, heading, initial, taskTypes, actionCategories = [],
  showDate = false, showTime = true, showRepeat = false,
  seriesInstance = false, onStopSeries,
  onSubmit, onDelete, submitLabel = "บันทึก",
}: {
  open: boolean;
  onClose: () => void;
  heading: string;
  initial: SheetInitial;
  taskTypes: TaskType[];
  /** action_category keys. Empty = the picker is not offered at all. */
  actionCategories?: string[];
  showDate?: boolean;
  showTime?: boolean;
  showRepeat?: boolean;
  seriesInstance?: boolean;
  onStopSeries?: () => void;
  onSubmit: (v: SheetValues) => void;
  onDelete?: () => void;
  submitLabel?: string;
}) {
  const today = bkkToday();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [actionCategory, setActionCategory] = useState<string | null>(null);
  const [targetQuantity, setTargetQuantity] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [freq, setFreq] = useState<"none" | RecurFreq>("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [dom, setDom] = useState(Number(today.slice(8, 10)));

  // Re-seed on every open, so a reused instance never leaks the last task's
  // values into a fresh "เพิ่มงานใหม่".
  useEffect(() => {
    if (!open) return;
    setTitle(initial.title ?? "");
    setNotes(initial.notes ?? "");
    setKind(initial.kind ?? taskTypes[0]?.key ?? null);
    // NOT defaulted to the first category, unlike `kind` above: a task type is
    // a colour and guessing one is harmless, while a stray action category
    // would put a Show on the scoreboard because someone typed a to-do.
    setActionCategory(initial.actionCategory ?? null);
    setTargetQuantity(
      initial.targetQuantity === null || initial.targetQuantity === undefined
        ? ""
        : String(initial.targetQuantity)
    );
    setDate(initial.date ?? "");
    setStartTime(initial.startTime ?? "");
    setEndTime(initial.endTime ?? "");
    setFreq("none");
    setWeekdays([]);
    setDom(Number(today.slice(8, 10)));
    // Intentionally keyed on `open` alone: re-seeding whenever `initial`
    // changes identity would wipe what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes; the page behind is scroll-locked so a touch drag inside the
  // sheet doesn't scroll the dashboard underneath it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const weeklyIncomplete = freq === "weekly" && weekdays.length === 0;
  const badRange = showTime && !!startTime && !!endTime && endTime < startTime;
  const canSave = !!title.trim() && !weeklyIncomplete && !badRange;

  const submit = () => {
    if (!canSave) return;
    onSubmit({
      title: title.trim(),
      notes: notes.trim(),
      kind,
      actionCategory,
      // A count with no category would be a number attached to nothing —
      // only a categorised task ever writes an activity to put it on.
      targetQuantity: actionCategory ? targetQuantity.trim() : "",
      date: showDate ? date : "",
      startTime: showTime ? startTime : "",
      endTime: showTime ? endTime : "",
      repeat: !showRepeat || freq === "none" ? null : {
        freq,
        weekdays: freq === "weekly" ? [...weekdays].sort((a, b) => a - b).join(",") : "",
        dayOfMonth: freq === "monthly" ? dom : null,
      },
    });
    onClose();
  };

  const input = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-accent";

  return (
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[30rem] overflow-y-auto rounded-t-[24px] bg-surface p-5 border border-line-strong shadow-xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="text-[1rem] font-bold text-ink">{heading}</div>
          <button onClick={onClose} aria-label="ปิด" className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-line text-ink-2 transition-colors hover:text-ink">
            <X size={16} />
          </button>
        </div>

        {seriesInstance && (
          <div className="mb-3.5 flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-[0.78rem] font-semibold text-accent-text">
            <Repeat size={14} className="shrink-0" />
            <span className="flex-1">งานนี้มาจากงานที่ทำซ้ำ — แก้ที่นี่มีผลเฉพาะวันนี้</span>
            {onStopSeries && (
              <button
                onClick={() => { onStopSeries(); onClose(); }}
                className="shrink-0 rounded-full border border-accent px-2.5 py-1 text-[0.72rem] font-semibold"
              >
                หยุดทำซ้ำ
              </button>
            )}
          </div>
        )}

        <Field label="หัวข้องาน">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="หัวข้อสั้น ๆ" className={input} />
        </Field>

        <Field label="รายละเอียด">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="รายละเอียดของงาน (ไม่บังคับ)" rows={3} className={`${input} resize-y leading-relaxed`} />
        </Field>

        {taskTypes.length > 0 && (
          <Field label="ประเภท">
            <div className="flex flex-wrap gap-2">
              {taskTypes.map((t) => {
                const on = kind === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setKind(t.key)}
                    className={`rounded-full px-3.5 py-2 text-[0.8rem] font-semibold transition-colors ${on ? "text-accent-ink" : "border border-line text-ink-2"}`}
                    style={on ? { background: taskToneVar(t.tone) } : undefined}
                  >
                    {t.key}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {actionCategories.length > 0 && (
          <Field label="บันทึกเป็นกิจกรรม (ไม่บังคับ)">
            <div className="flex flex-wrap gap-2">
              {actionCategories.map((c) => {
                const on = actionCategory === c;
                return (
                  <button
                    key={c}
                    onClick={() => setActionCategory(on ? null : c)}
                    className={`rounded-full px-3.5 py-2 text-[0.8rem] font-semibold transition-colors ${
                      on
                        ? "bg-accent text-accent-ink"
                        : "border border-line text-ink-2"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {/* The count rides WITH the category and disappears with it: a
                target on an uncategorised task would never be logged
                anywhere, so offering the box would be a promise the tick
                cannot keep. */}
            {actionCategory && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[0.78rem] text-ink-2">ตั้งเป้าจำนวน</span>
                <input
                  type="number"
                  min={0}
                  value={targetQuantity}
                  onChange={(e) => setTargetQuantity(e.target.value)}
                  placeholder="—"
                  aria-label="ตั้งเป้าจำนวน"
                  className="num w-24 rounded-xl border border-line bg-surface-2 px-3 py-2 text-[0.85rem] text-ink outline-none transition-colors focus:border-accent"
                />
                <span className="text-[0.72rem] text-ink-3">
                  ใส่ไว้แล้วตอนติ๊กจะถามว่าทำได้จริงกี่รายการ
                </span>
              </div>
            )}
            <p className="mt-2 text-[0.72rem] text-ink-3">
              เลือกไว้แล้วเมื่อติ๊กว่าเสร็จ ระบบจะบันทึกกิจกรรมนี้ให้อัตโนมัติ ·
              กดซ้ำเพื่อยกเลิก · บันทึกแล้วย้อนกลับไม่ได้
            </p>
          </Field>
        )}

        {showDate && (
          <Field label="จัดลงวันที่ (ไม่บังคับ)">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar size={15} className="shrink-0 text-ink-3" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="วันที่" className={`${input} num w-auto`} />
              {date && (
                <button onClick={() => setDate("")} className="rounded-full border border-line px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink-2">ล้าง</button>
              )}
            </div>
            <p className="mt-2 text-[0.72rem] text-ink-3">เลือกวันเพื่อย้ายไปลงแผนของวันนั้น · เว้นว่างไว้เพื่อเก็บในรายการรอ</p>
          </Field>
        )}

        {showTime && (
          <Field label="เวลา (ไม่บังคับ)">
            <div className="flex flex-wrap items-center gap-2">
              <Clock size={15} className="shrink-0 text-ink-3" />
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="เวลาเริ่ม" className={`${input} num w-auto`} />
              <span className="text-ink-3">–</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="เวลาสิ้นสุด" className={`${input} num w-auto`} />
              {(startTime || endTime) && (
                <button onClick={() => { setStartTime(""); setEndTime(""); }} className="rounded-full border border-line px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink-2">ล้าง</button>
              )}
            </div>
            {badRange && <p className="mt-2 text-[0.72rem] text-bad">เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม</p>}
          </Field>
        )}

        {showRepeat && (
          <Field label="ทำซ้ำ">
            <div className="flex flex-wrap gap-2">
              <Pill label="ไม่ซ้ำ" on={freq === "none"} onClick={() => setFreq("none")} />
              {RECUR_FREQS.map((f) => <Pill key={f} label={RECUR_LABEL[f]} on={freq === f} onClick={() => setFreq(f)} />)}
            </div>

            {freq === "weekly" && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_PICKER_ORDER.map((n) => {
                    const on = weekdays.includes(n);
                    return (
                      <button
                        key={n}
                        onClick={() => setWeekdays((ws) => (ws.includes(n) ? ws.filter((x) => x !== n) : [...ws, n]))}
                        aria-pressed={on}
                        className={`h-10 w-10 rounded-xl text-[0.8rem] font-semibold transition-colors ${on ? "bg-accent text-accent-ink" : "border border-line text-ink-2"}`}
                      >
                        {WEEKDAY_LABELS[n]}
                      </button>
                    );
                  })}
                </div>
                {weeklyIncomplete && <p className="mt-2 text-[0.72rem] text-bad">เลือกอย่างน้อยหนึ่งวัน</p>}
              </div>
            )}

            {freq === "monthly" && (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-[0.82rem] text-ink-2">
                  <span>ทุกวันที่</span>
                  <input
                    type="number" min={1} max={31} value={dom}
                    onChange={(e) => setDom(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                    className={`${input} num w-20 text-center`}
                  />
                  <span>ของเดือน</span>
                </div>
                {/* Rather than silently retargeting to the 28th, which would be
                    a different rule from the one she set. */}
                {dom > 28 && <p className="mt-2 text-[0.72rem] text-ink-3">เดือนที่ไม่มีวันที่ {dom} จะข้ามไป</p>}
              </div>
            )}
          </Field>
        )}

        <div className="mt-5 flex items-center gap-2.5">
          <button
            onClick={submit}
            disabled={!canSave}
            className="flex-1 rounded-xl bg-accent py-3 text-[0.95rem] font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:bg-surface-3 disabled:text-ink-3"
          >
            {submitLabel}
          </button>
          {onDelete && (
            <button
              onClick={() => { onDelete(); onClose(); }}
              aria-label="ลบ"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line text-bad transition-colors hover:bg-bad-soft"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[0.72rem] font-semibold text-ink-2">{label}</div>
      {children}
    </div>
  );
}

function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3.5 py-2 text-[0.8rem] font-semibold transition-colors ${on ? "bg-accent text-accent-ink" : "border border-line text-ink-2"}`}
    >
      {label}
    </button>
  );
}
