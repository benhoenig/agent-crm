"use client";

/* The task list — one row per task, plus a quick-add.

   Ported from Solo Gang's TodoList. The row stays deliberately minimal: tick,
   time, title, two tiny badges, a category chip. Everything else lives behind
   a tap on the title, in the detail sheet — a row that carries every control
   is unusable on a phone, which is where this list is actually read.

   DRAG uses Pointer Events, not HTML5 drag-and-drop, because HTML5 drag never
   fires on touch. The existing @dnd-kit in this project is not reused here: it
   is wired for the listing/lead boards' sortable grids, and this is a single
   vertical list inside a scroll-locked card — the port's own handler is 30
   lines and behaves identically on mouse and finger. */

import { useEffect, useRef, useState } from "react";
import { Check, Plus, GripVertical, Repeat, FileText, SlidersHorizontal, Clock, CalendarPlus, Link2 } from "lucide-react";
import { taskToneVar, type TaskType } from "@/lib/plan";
import { isLinked, parseLeadingTime, timeRange, type PlanTask } from "@/lib/plan";
import { TaskDetailSheet, type SheetValues } from "./TaskDetailSheet";

export interface TodoListProps {
  tasks: PlanTask[];
  taskTypes: TaskType[];
  /** action_category keys — the detail sheet's "บันทึกเป็นกิจกรรม" picker.
      Empty (the default) hides it, so a surface that has no business logging
      activity simply does not offer it. */
  actionCategories?: string[];
  onUpdate: (id: string, patch: Partial<PlanTask>) => void;
  onDelete: (id: string) => void;
  onAdd: (title: string, opts?: Partial<PlanTask>) => void;
  /** Given → the detail sheet offers the repeat selector. */
  onCreateRecurring?: (spec: { title: string; notes: string; kind: string | null; actionCategory: string | null; targetQuantity: number | null; freq: string; weekdays: string; dayOfMonth: number | null; startTime: string; endTime: string }) => void;
  /** Given → an instance from a series offers "หยุดทำซ้ำ". */
  onStopRecurring?: (ruleId: string) => void;
  /** Backlog only: 📅 moves a task into the day being planned. */
  onSchedule?: (id: string) => void;
  /** Backlog only: the sheet gains a date picker. */
  onScheduleAt?: (id: string, patch: Partial<PlanTask> & { date: string }) => void;
  onReorder?: (orderedIds: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}

export function TodoList({
  tasks, taskTypes, actionCategories = [], onUpdate, onDelete, onAdd, onCreateRecurring, onStopRecurring,
  onSchedule, onScheduleAt, onReorder,
  placeholder = "เพิ่มงาน…", emptyText = "ยังไม่มีงาน — เพิ่มงานแรกของวันนี้",
}: TodoListProps) {
  const [draft, setDraft] = useState("");
  /* THE QUICK-ADD IS THE ACTIVITY LOG NOW (Ben, 2026-08-30). กิจกรรมวันนี้
     used to carry its own composer; these two fields are what replaced it, so
     logging a Show is: type it, pick it, add, tick. The count is a TARGET —
     ticking asks what actually happened before writing anything down.

     THEY ARE PART OF THE COMPOSE ROW, NOT A MODE. The first cut folded eight
     category chips away behind a header that ARMED the next add, which is
     invisible state: you could collapse it, add three tasks, and only later
     find each had logged a Show. A select sitting in the row it belongs to
     always shows what it is set to, so there is nothing to remember. */
  const [addCategory, setAddCategory] = useState<string | null>(null);
  const [addQuantity, setAddQuantity] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);
  // A backlog task has no day, so no time-of-day and no quick-add parsing.
  const allowTime = !onSchedule;
  const parsed = allowTime ? parseLeadingTime(draft) : { title: draft.trim(), startTime: "", endTime: "" };

  const submit = () => {
    const v = draft.trim();
    // Nothing to add without a title, and a dead button is worse than a
    // refusal — put the cursor where the missing thing goes (Ben, 2026-08-30:
    // "where's the button to add to the daily plan").
    if (!v) {
      draftRef.current?.focus();
      return;
    }
    // A count with no category has nothing to be logged onto, so it is
    // dropped rather than silently stored on a task that will never log.
    const qty = addCategory && addQuantity.trim() !== "" ? Number(addQuantity) : null;
    const extra = {
      actionCategory: addCategory,
      targetQuantity: Number.isFinite(qty as number) ? qty : null,
    };
    if (allowTime && parsed.startTime)
      onAdd(parsed.title, { ...extra, startTime: parsed.startTime, endTime: parsed.endTime || null });
    else onAdd(v, extra);
    setDraft("");
    // The CATEGORY is kept and the count cleared: logging three showings in a
    // row is the common case, and re-tapping the same chip each time is the
    // kind of friction that sends people back to writing it down elsewhere.
    setAddQuantity("");
  };

  const [sheet, setSheet] = useState<{ mode: "new" } | { mode: "edit"; task: PlanTask } | null>(null);

  /* ---- drag to reorder ---- */
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const overRef = useRef<string | null>(null);
  const setOver = (id: string | null) => { overRef.current = id; setOverId(id); };

  useEffect(() => {
    if (!dragId || !onReorder) return;
    const move = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const row = el?.closest("[data-task-id]");
      const id = row?.getAttribute("data-task-id") ?? null;
      if (id !== overRef.current) setOver(id);
      if (e.cancelable) e.preventDefault(); // stop the page scrolling under a touch-drag
    };
    const up = () => {
      const target = overRef.current;
      if (target && target !== dragId) {
        const ids = tasks.map((t) => t.id);
        ids.splice(ids.indexOf(dragId), 1);
        ids.splice(ids.indexOf(target), 0, dragId);
        onReorder(ids);
      }
      setDragId(null);
      setOver(null);
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
    };
  }, [dragId, tasks, onReorder]);

  const onSheetSubmit = (v: SheetValues) => {
    if (sheet?.mode === "new") {
      if (v.repeat && onCreateRecurring) {
        onCreateRecurring({
          title: v.title, notes: v.notes, kind: v.kind, actionCategory: v.actionCategory,
          targetQuantity: v.targetQuantity === "" ? null : Number(v.targetQuantity),
          freq: v.repeat.freq, weekdays: v.repeat.weekdays, dayOfMonth: v.repeat.dayOfMonth,
          startTime: v.startTime, endTime: v.endTime,
        });
      } else {
        onAdd(v.title, {
          notes: v.notes || null, kind: v.kind, actionCategory: v.actionCategory,
          targetQuantity: v.targetQuantity === "" ? null : Number(v.targetQuantity),
          startTime: v.startTime || null, endTime: v.endTime || null,
        });
      }
    } else if (sheet?.mode === "edit") {
      const base = {
        title: v.title, notes: v.notes || null, kind: v.kind,
        actionCategory: v.actionCategory,
        targetQuantity: v.targetQuantity === "" ? null : Number(v.targetQuantity),
      };
      // Backlog: picking a date schedules it into that day; leaving it blank
      // keeps it in the backlog. Times only mean anything once it has a day.
      if (onScheduleAt && v.date) {
        onScheduleAt(sheet.task.id, { ...base, date: v.date, startTime: v.startTime || null, endTime: v.endTime || null });
      } else if (onScheduleAt) {
        onUpdate(sheet.task.id, base);
      } else {
        onUpdate(sheet.task.id, { ...base, startTime: v.startTime || null, endTime: v.endTime || null });
      }
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      {!tasks.length && <div className="px-1.5 py-1 text-[0.82rem] text-ink-3">{emptyText}</div>}

      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          taskTypes={taskTypes}
          onUpdate={onUpdate}
          onOpen={() => setSheet({ mode: "edit", task: t })}
          onSchedule={onSchedule}
          draggable={!!onReorder}
          dragging={dragId === t.id}
          dragOver={overId === t.id && dragId !== t.id}
          onGrab={() => setDragId(t.id)}
        />
      ))}

      {/* ONE ROW, NOT A MODE (Ben, 2026-08-30: "make it more intuitively
          easy"). The first cut of this was a foldaway strip of category chips
          that ARMED the next add — and arming is invisible state, which is
          why it needed a summary pill and a paragraph to be safe to use. A
          thing you fill in left to right and submit needs neither.

          THE CATEGORY IS A SELECT, NOT CHIPS. Eight pills is a wall; a select
          is one control that always shows its current value, costs one line
          whatever the picklist grows to, and opens as a native wheel on the
          phones this is mostly used on.

          THE COUNT APPEARS WITH A CATEGORY and not before, because a number
          with nothing to log it against would be stored and never written
          anywhere. */}
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          ref={draftRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          className="w-full min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[0.875rem] text-ink outline-none transition-colors focus:border-accent sm:w-auto"
        />

        {actionCategories.length > 0 && (
          <select
            value={addCategory ?? ""}
            onChange={(e) => setAddCategory(e.target.value || null)}
            aria-label="บันทึกเป็นกิจกรรม"
            title="เลือกไว้แล้ว ติ๊กว่าเสร็จจะบันทึกเป็นกิจกรรมให้อัตโนมัติ"
            className={`min-w-0 shrink-0 rounded-xl border bg-surface-2 px-2.5 py-2.5 text-[0.8rem] outline-none transition-colors focus:border-accent ${
              addCategory ? "border-accent text-ink" : "border-line text-ink-3"
            }`}
          >
            <option value="">ไม่บันทึกกิจกรรม</option>
            {actionCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {addCategory && (
          <input
            type="number"
            min={0}
            value={addQuantity}
            onChange={(e) => setAddQuantity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="เป้า"
            aria-label="ตั้งเป้าจำนวน"
            className="num w-16 shrink-0 rounded-xl border border-line bg-surface-2 px-2.5 py-2.5 text-[0.8rem] text-ink outline-none transition-colors focus:border-accent"
          />
        )}

        <button
          onClick={() => setSheet({ mode: "new" })}
          aria-label="เพิ่มพร้อมรายละเอียด"
          title="เพิ่มพร้อมรายละเอียด / ตั้งค่าทำซ้ำ"
          className="grid w-11 shrink-0 place-items-center rounded-xl border border-line text-ink-2 transition-colors hover:text-accent-text"
        >
          <SlidersHorizontal size={17} />
        </button>
        <button
          onClick={submit}
          aria-label="เพิ่มงาน"
          className="grid w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* One line, only once a category is chosen — it says what the tick will
          do, at the moment that becomes true. */}
      {addCategory && (
        <p className="mt-1.5 pl-0.5 text-[0.7rem] text-accent-text">
          ติ๊กว่าเสร็จแล้วจะบันทึกเป็น “{addCategory}”
          {addQuantity.trim() !== "" && ` — ถามก่อนว่าทำได้จริงกี่รายการ`}
        </p>
      )}

      {/* Live confirmation that a leading time was recognised, so the parse is
          never a surprise after the fact. */}
      {allowTime && parsed.startTime && (
        <div className="mt-1.5 flex items-center gap-1.5 pl-0.5 text-[0.72rem] text-accent-text">
          <Clock size={12} /> ตั้งเวลา {timeRange(parsed.startTime, parsed.endTime || null)} · “{parsed.title}”
        </div>
      )}

      <TaskDetailSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        heading={sheet?.mode === "edit" ? "แก้ไขงาน" : "เพิ่มงานใหม่"}
        initial={sheet?.mode === "edit" ? sheet.task : {}}
        taskTypes={taskTypes}
        actionCategories={actionCategories}
        showDate={!!onScheduleAt && sheet?.mode === "edit"}
        showTime={allowTime || (!!onScheduleAt && sheet?.mode === "edit")}
        showRepeat={!!onCreateRecurring && sheet?.mode === "new"}
        seriesInstance={sheet?.mode === "edit" && !!sheet.task.recurringId}
        onStopSeries={
          sheet?.mode === "edit" && sheet.task.recurringId && onStopRecurring
            ? () => onStopRecurring(sheet.task.recurringId!)
            : undefined
        }
        onSubmit={onSheetSubmit}
        onDelete={sheet?.mode === "edit" ? () => onDelete(sheet.task.id) : undefined}
        submitLabel={sheet?.mode === "edit" ? "บันทึก" : "เพิ่มงาน"}
      />
    </div>
  );
}

function TaskRow({
  task, taskTypes, onUpdate, onOpen, onSchedule, draggable, dragging, dragOver, onGrab,
}: {
  task: PlanTask;
  taskTypes: TaskType[];
  onUpdate: (id: string, patch: Partial<PlanTask>) => void;
  onOpen: () => void;
  onSchedule?: (id: string) => void;
  draggable: boolean;
  dragging: boolean;
  dragOver: boolean;
  onGrab: () => void;
}) {
  const idx = taskTypes.findIndex((t) => t.key === task.kind);
  const type = taskTypes[idx] ?? taskTypes[0];
  // Tap cycles through Cream's list in HER order, so adding a fourth category
  // in Settings puts it in the cycle without touching this file.
  const next = taskTypes.length ? taskTypes[(Math.max(idx, 0) + 1) % taskTypes.length] : undefined;
  const hasNotes = !!task.notes?.trim();
  // Promoted out of ติดตามวันนี้: ticking this writes a CRM activity, and a
  // ticked one cannot be undone because that activity is append-only.
  const linked = isLinked(task);

  return (
    <div
      data-task-id={task.id}
      // items-start, not center: a long title wraps to several lines and the
      // tick must stay level with the first one, not float to the middle.
      className={`flex items-start gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors ${dragging ? "opacity-40" : ""} ${dragOver ? "bg-accent-soft shadow-[inset_0_2px_0_var(--accent)]" : ""}`}
    >
      {draggable && (
        <button
          aria-label="ลากเพื่อจัดลำดับ"
          onPointerDown={(e) => { e.preventDefault(); onGrab(); }}
          className={`grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center ${dragging ? "text-accent-text" : "text-ink-3"}`}
        >
          <GripVertical size={17} />
        </button>
      )}

      <button
        onClick={() => onUpdate(task.id, { done: !task.done })}
        disabled={linked && task.done}
        aria-label={task.done ? "ยกเลิกเสร็จ" : "ทำเสร็จ"}
        aria-pressed={task.done}
        title={linked
          ? (task.done
              ? "บันทึกการติดตามแล้ว — ย้อนกลับไม่ได้"
              : "ติ๊กแล้วจะบันทึกการติดตามในประวัติของรายการนี้ให้เอง")
          : undefined}
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors ${task.done ? "bg-accent" : "border-[1.5px] border-line-strong"} ${linked && task.done ? "cursor-default" : ""}`}
      >
        {task.done && <Check size={12} strokeWidth={3} className="-translate-x-px text-accent-ink" />}
      </button>

      {task.startTime && (
        <span className={`num mt-0.5 shrink-0 text-[0.72rem] font-bold ${task.done ? "text-ink-3" : "text-accent-text"}`}>
          {task.startTime}
        </span>
      )}

      <button
        onClick={onOpen}
        title="แตะเพื่อดูรายละเอียด"
        className={`min-w-0 flex-1 break-words text-left text-[0.875rem] leading-normal ${task.done ? "text-ink-3 line-through" : "text-ink"}`}
      >
        {task.title}
        {/* The planned count, shown on the row because a target you cannot
                see is not a target — you would only meet it by accident.
                Paired with the category, since one is meaningless without
                the other. */}
            {task.actionCategory && task.targetQuantity !== null && (
              <span className="num ml-1.5 align-middle text-[0.7rem] font-semibold text-accent-text">
                ×{task.targetQuantity}
              </span>
            )}
        {(task.recurringId || hasNotes || linked) && (
          <span className="ml-1.5 inline-flex items-center gap-1.5 align-middle text-ink-3">
            {task.recurringId && <Repeat size={12} className="text-accent-text" />}
            {hasNotes && <FileText size={12} />}
            {/* Marks the row as tied to a lead or listing, so the different
                tick behaviour is visible before it is discovered. */}
            {linked && <Link2 size={12} className="text-info" />}
          </span>
        )}
      </button>

      {type && next && (
        <button
          onClick={() => onUpdate(task.id, { kind: next.key })}
          title={`สลับประเภทงาน (${taskTypes.map((t) => t.key).join(" / ")})`}
          className="mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold text-accent-ink"
          style={{ background: taskToneVar(type.tone) }}
        >
          {type.key}
        </button>
      )}

      {onSchedule && (
        <button
          onClick={() => onSchedule(task.id)}
          aria-label="จัดลงแผน"
          title="จัดลงแผนของวันที่เลือก"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-accent-text transition-colors hover:bg-accent-soft"
        >
          <CalendarPlus size={16} />
        </button>
      )}
    </div>
  );
}
