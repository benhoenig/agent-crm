"use client";

/* /plan — every task in one list, for managing rather than doing.

   THE DASHBOARD CARD AND THIS PAGE ANSWER DIFFERENT QUESTIONS. แผนประจำวัน is
   "what am I doing today" — one day, big tick targets, a completion ring. This
   is "where has everything got to" — all dates at once, what slipped, what is
   still unscheduled, what got done. Same tables, same mutations, same undo
   stack; different question, so a different shape rather than a longer card.

   IT REUSES `usePlanner` WHOLESALE. Every edit made here goes through the same
   handlers as the card, which is what keeps the two consistent — and it means
   ⌘Z works on this page for free, including the bulk reschedule, which records
   itself as ONE entry rather than eleven.

   GROUPED BY WHEN, NOT SORTED BY IT. A flat list ordered by date buries the
   only two groups that need action — what is overdue and what was never
   scheduled — somewhere in the middle. The sections are the point. */

import { useMemo, useState } from "react";
import { CalendarDays, Check, Link2, Repeat, FileText, Search, X, ChevronDown } from "lucide-react";
import { PlanCard } from "./Bits";
import { taskToneVar, type TaskType } from "@/lib/plan";
import {
  addDays, compareDayTasks, isLinked, planDateLabel, timeRange, type PlanData, type PlanTask,
} from "@/lib/plan";
import { TaskDetailSheet, type SheetValues } from "./TaskDetailSheet";
import { HistoryBar } from "./HistoryBar";
import { QuantityPrompt } from "./QuantityPrompt";
import { usePlanner } from "./usePlanner";
import { useUndoShortcuts } from "./useHistory";

type Status = "open" | "done" | "all";

const STATUSES: { key: Status; label: string }[] = [
  { key: "open", label: "ยังไม่เสร็จ" },
  { key: "done", label: "เสร็จแล้ว" },
  { key: "all", label: "ทั้งหมด" },
];

/* ---- the time filter ----------------------------------------------------
   Ported from the Klaichan CRM, where Cream asked for it in the same words
   Ben did (2026-08-30). The page already holds a YEAR of tasks (getPlan's
   HISTORY_DAYS floor), so looking back was always possible but never
   findable — anything older than this week sat below a long เสร็จแล้ว list.

   PAST-FACING, unlike the dashboard's presets. That card asks "how are we
   doing so far", so its windows all end today (mtd, qtd, ytd). This one is
   for checking what happened, so it offers whole periods that have already
   closed — เดือนที่แล้ว being the one people actually reach for.

   Filtering is client-side because the rows are already here. A server round
   trip would add nothing except a spinner. */
type RangeKey = "all" | "today" | "7d" | "month" | "lastmonth" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "today", label: "วันนี้" },
  { key: "7d", label: "7 วัน" },
  { key: "month", label: "เดือนนี้" },
  { key: "lastmonth", label: "เดือนที่แล้ว" },
  { key: "custom", label: "กำหนดเอง" },
];

/** Inclusive [start, end] for a preset, or null for "no window at all".
    Built off the planner's own `today` rather than a fresh Date, so the page
    and the tasks it filters agree on what day it is in Bangkok. */
function rangeBounds(
  key: RangeKey,
  today: string,
  from: string,
  to: string
): { start: string; end: string } | null {
  const [y, m] = today.split("-").map(Number);
  const firstOf = (yy: number, mm: number) =>
    `${yy}-${String(mm).padStart(2, "0")}-01`;
  const lastOf = (yy: number, mm: number) => {
    const next = mm === 12 ? firstOf(yy + 1, 1) : firstOf(yy, mm + 1);
    return addDays(next, -1);
  };
  switch (key) {
    case "all": return null;
    case "today": return { start: today, end: today };
    case "7d": return { start: addDays(today, -6), end: today };
    case "month": return { start: firstOf(y, m), end: lastOf(y, m) };
    case "lastmonth": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { start: firstOf(py, pm), end: lastOf(py, pm) };
    }
    // An incomplete custom range filters nothing rather than everything: a
    // half-typed date must not blank the page.
    case "custom": return from && to ? { start: from, end: to } : null;
  }
}

export function PlanBrowser({
  initial,
  taskTypes,
  actionCategories = [],
}: {
  initial: PlanData;
  taskTypes: TaskType[];
  /** action_category keys, in picklist order. */
  actionCategories?: string[];
}) {
  const planner = usePlanner(initial);
  useUndoShortcuts(planner.history);

  const { allTasks, today, updateTask, removeTask, rescheduleMany } = planner;

  const [status, setStatus] = useState<Status>("open");
  const [kind, setKind] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [rangeKey, setRangeKey] = useState<RangeKey>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [edit, setEdit] = useState<PlanTask | null>(null);

  const bounds = useMemo(
    () => rangeBounds(rangeKey, today, from, to),
    [rangeKey, today, from, to]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allTasks.filter((t) => {
      if (status === "open" && t.done) return false;
      if (status === "done" && !t.done) return false;
      if (kind && t.kind !== kind) return false;
      // UNDATED TASKS SURVIVE EVERY WINDOW. รายการรอ belongs to no date by
      // definition, so a date filter has nothing to say about it — dropping it
      // would read as "the backlog is empty in March", which is not a fact.
      if (bounds && t.date && (t.date < bounds.start || t.date > bounds.end)) return false;
      if (needle && !`${t.title} ${t.notes ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [allTasks, status, kind, q, bounds]);

  /* FIVE BUCKETS, in the order they need attention: what slipped, the day
     itself, what is coming, what was never scheduled, what is finished.

     Everything after today goes in ONE bucket with date subheadings rather
     than a card per date. A card per date looks tidy with three days of work
     and turns into a column of mostly-chrome once there are twenty — one task
     on Monday does not deserve the same frame as the whole overdue list. The
     three buckets that need action keep their own cards precisely because
     they are the ones worth separating. */
  const groups = useMemo(() => {
    const overdue: PlanTask[] = [];
    const todayTasks: PlanTask[] = [];
    const backlog: PlanTask[] = [];
    const done: PlanTask[] = [];
    const byDate = new Map<string, PlanTask[]>();

    for (const t of filtered) {
      // A completed task is filed under "done" wherever it sat, because its
      // date has stopped being a deadline and become a record.
      if (t.done) { done.push(t); continue; }
      if (!t.date) { backlog.push(t); continue; }
      if (t.date < today) { overdue.push(t); continue; }
      if (t.date === today) { todayTasks.push(t); continue; }
      const list = byDate.get(t.date) ?? [];
      list.push(t);
      byDate.set(t.date, list);
    }

    return {
      overdue: overdue.sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : compareDayTasks(a, b))),
      today: todayTasks.sort(compareDayTasks),
      upcoming: [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, list]) => ({ date, list: list.sort(compareDayTasks) })),
      backlog: backlog.sort((a, b) => a.sortOrder - b.sortOrder),
      done: done.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    };
  }, [filtered, today]);

  const upcomingCount = groups.upcoming.reduce((n, g) => n + g.list.length, 0);
  const totalShown = groups.overdue.length + groups.today.length + upcomingCount
    + groups.backlog.length + groups.done.length;

  const onSheetSubmit = (v: SheetValues) => {
    if (!edit) return;
    updateTask(edit.id, {
      title: v.title,
      notes: v.notes || null,
      kind: v.kind,
      actionCategory: v.actionCategory,
      targetQuantity: v.targetQuantity === "" ? null : Number(v.targetQuantity),
      // The sheet always offers a date here: rescheduling IS the management
      // action this page exists for. Blank clears it back to the backlog.
      date: v.date || null,
      startTime: v.startTime || null,
      endTime: v.endTime || null,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <QuantityPrompt planner={planner} />
      <Summary planner={planner} />

      <PlanCard className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหางาน…"
              className="w-full rounded-xl border border-line bg-surface-2 py-2.5 pl-9 pr-8 text-[0.875rem] text-ink outline-none transition-colors focus:border-accent"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="ล้างคำค้น"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface-3 p-0.5">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                onClick={() => setStatus(s.key)}
                aria-pressed={s.key === status}
                className={`rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition-colors ${
                  s.key === status ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* When did it happen. Sits above the category chips because it is the
            coarser cut: you pick the month first, then narrow by type. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGES.map((r) => (
            <Chip key={r.key} on={rangeKey === r.key} onClick={() => setRangeKey(r.key)}>
              {r.label}
            </Chip>
          ))}
          {rangeKey === "custom" && (
            <span className="flex items-center gap-1.5">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="num rounded-lg border border-line bg-surface-2 px-2 py-1 text-[0.75rem] outline-none focus:border-accent" />
              <span className="text-[0.72rem] text-ink-3">ถึง</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="num rounded-lg border border-line bg-surface-2 px-2 py-1 text-[0.75rem] outline-none focus:border-accent" />
            </span>
          )}
          {bounds && (
            <span className="text-[0.7rem] text-ink-3">
              {planDateLabel(bounds.start)} – {planDateLabel(bounds.end)} · รายการที่ยังไม่ลงวันแสดงเสมอ
            </span>
          )}
        </div>

        {/* Category filter reads the client's own list, so a renamed or added
            category appears here without touching this file. */}
        {taskTypes.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            <Chip on={kind === null} onClick={() => setKind(null)}>ทุกประเภท</Chip>
            {taskTypes.map((t) => (
              <Chip key={t.key} on={kind === t.key} onClick={() => setKind(kind === t.key ? null : t.key)}
                color={taskToneVar(t.tone)}>
                {t.key}
              </Chip>
            ))}
          </div>
        )}
      </PlanCard>

      <HistoryBar history={planner.history} />

      {totalShown === 0 ? (
        <PlanCard>
          <p className="text-[0.85rem] text-ink-2">
            {q || kind || bounds ? "ไม่พบงานที่ตรงกับตัวกรอง" : "ยังไม่มีงานในช่วงนี้"}
          </p>
        </PlanCard>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.overdue.length > 0 && (
            <Section
              title="เกินกำหนด"
              count={groups.overdue.length}
              tone="red"
              action={
                <button
                  onClick={() => rescheduleMany(groups.overdue.map((t) => t.id), today)}
                  className="rounded-full border border-bad px-2.5 py-1 text-[0.72rem] font-semibold text-bad transition-colors hover:bg-bad-soft"
                >
                  เลื่อนมาวันนี้ทั้งหมด
                </button>
              }
            >
              {groups.overdue.map((t) => (
                <Row key={t.id} task={t} taskTypes={taskTypes} today={today}
                  onToggle={() => updateTask(t.id, { done: !t.done })} onOpen={() => setEdit(t)} showDate />
              ))}
            </Section>
          )}

          {groups.today.length > 0 && (
            <Section title={planDateLabel(today)} hint="วันนี้" count={groups.today.length} tone="accent">
              {groups.today.map((t) => (
                <Row key={t.id} task={t} taskTypes={taskTypes} today={today}
                  onToggle={() => updateTask(t.id, { done: !t.done })} onOpen={() => setEdit(t)} />
              ))}
            </Section>
          )}

          {upcomingCount > 0 && (
            <Section title="กำลังจะถึง" count={upcomingCount} tone="plain">
              {groups.upcoming.map((g) => (
                <li key={g.date} className="py-1 first:pt-0">
                  <div className="flex items-baseline gap-2 pb-1 pt-2 text-[0.75rem] font-semibold text-ink-2">
                    {planDateLabel(g.date)}
                    {g.date === addDays(today, 1) && (
                      <span className="text-[0.7rem] font-normal text-ink-3">พรุ่งนี้</span>
                    )}
                  </div>
                  <ul className="flex flex-col divide-y divide-line">
                    {g.list.map((t) => (
                      <Row key={t.id} task={t} taskTypes={taskTypes} today={today}
                        onToggle={() => updateTask(t.id, { done: !t.done })} onOpen={() => setEdit(t)} />
                    ))}
                  </ul>
                </li>
              ))}
            </Section>
          )}

          {groups.backlog.length > 0 && (
            <Section title="รายการรอ" hint="ยังไม่ลงวัน" count={groups.backlog.length} tone="plain">
              {groups.backlog.map((t) => (
                <Row key={t.id} task={t} taskTypes={taskTypes} today={today}
                  onToggle={() => updateTask(t.id, { done: !t.done })} onOpen={() => setEdit(t)} />
              ))}
            </Section>
          )}

          {groups.done.length > 0 && (
            <Collapsible title="เสร็จแล้ว" count={groups.done.length}>
              {groups.done.map((t) => (
                <Row key={t.id} task={t} taskTypes={taskTypes} today={today}
                  onToggle={() => updateTask(t.id, { done: !t.done })} onOpen={() => setEdit(t)} showDate />
              ))}
            </Collapsible>
          )}
        </div>
      )}

      <TaskDetailSheet
        open={!!edit}
        onClose={() => setEdit(null)}
        heading="แก้ไขงาน"
        initial={edit ?? {}}
        taskTypes={taskTypes}
        actionCategories={actionCategories}
        showDate
        showTime
        showRepeat={false}
        seriesInstance={!!edit?.recurringId}
        onSubmit={onSheetSubmit}
        onDelete={edit ? () => removeTask(edit.id) : undefined}
        submitLabel="บันทึก"
      />
    </div>
  );
}

/* ---------- summary ------------------------------------------------------- */

/** Four counts, and they are the reason to open this page: what slipped, what
    is due today, what is waiting, what is finished. Computed off ALL tasks,
    not the filtered set — a filter must not change what the totals mean. */
function Summary({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const { allTasks, today } = planner;
  const open = allTasks.filter((t) => !t.done);
  const stats = [
    { label: "เกินกำหนด", n: open.filter((t) => t.date && t.date < today).length, tone: "text-bad" },
    { label: "วันนี้", n: open.filter((t) => t.date === today).length, tone: "text-accent-text" },
    { label: "รายการรอ", n: open.filter((t) => !t.date).length, tone: "text-ink" },
    { label: "เสร็จแล้ว", n: allTasks.length - open.length, tone: "text-good" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <PlanCard key={s.label} className="!p-4">
          <div className="text-[0.72rem] text-ink-2">{s.label}</div>
          <div className={`num mt-0.5 text-[1.5rem] font-semibold leading-none ${s.tone}`}>{s.n}</div>
        </PlanCard>
      ))}
    </div>
  );
}

/* ---------- pieces -------------------------------------------------------- */

function Chip({ on, onClick, color, children }: {
  on: boolean; onClick: () => void; color?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition-colors ${
        on ? "bg-accent text-accent-ink" : "bg-surface-3 text-ink-2 hover:text-ink"
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: on ? "currentColor" : color }} />}
      {children}
    </button>
  );
}

function Section({ title, hint, count, tone, action, children }: {
  title: string; hint?: string; count: number;
  tone: "red" | "accent" | "plain"; action?: React.ReactNode; children: React.ReactNode;
}) {
  const head = tone === "red" ? "text-bad" : tone === "accent" ? "text-accent-text" : "text-ink";
  return (
    <PlanCard>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className={`flex items-baseline gap-2 text-[0.95rem] font-semibold ${head}`}>
          {title}
          {hint && <span className="text-[0.72rem] font-normal text-ink-3">{hint}</span>}
          <span className="num text-[0.78rem] font-normal text-ink-3">{count}</span>
        </h2>
        {action}
      </div>
      <ul className="flex flex-col divide-y divide-line">{children}</ul>
    </PlanCard>
  );
}

function Collapsible({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  // Shut by default: finished work is context, not a queue, and open it would
  // push everything actionable off the screen.
  const [open, setOpen] = useState(false);
  return (
    <PlanCard>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-2 text-[0.95rem] font-semibold text-ink-2">
          {title}
          <span className="num text-[0.78rem] font-normal text-ink-3">{count}</span>
        </h2>
        <ChevronDown size={16} className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <ul className="mt-3 flex flex-col divide-y divide-line">{children}</ul>}
    </PlanCard>
  );
}

function Row({ task, taskTypes, today, onToggle, onOpen, showDate }: {
  task: PlanTask;
  taskTypes: TaskType[];
  today: string;
  onToggle: () => void;
  onOpen: () => void;
  showDate?: boolean;
}) {
  const type = taskTypes.find((t) => t.key === task.kind);
  const linked = isLinked(task);
  const range = timeRange(task.startTime, task.endTime);
  const late = !task.done && task.date && task.date < today;

  return (
    <li className="flex items-start gap-2.5 py-2.5">
      <button
        onClick={onToggle}
        // Same rule as the card: a linked task's tick is a CRM write and a
        // ticked one cannot be undone, because the activity is append-only.
        disabled={linked && task.done}
        aria-label={task.done ? "ยกเลิกเสร็จ" : "ทำเสร็จ"}
        aria-pressed={task.done}
        title={linked
          ? (task.done ? "บันทึกการติดตามแล้ว — ย้อนกลับไม่ได้" : "ติ๊กแล้วจะบันทึกการติดตามให้เอง")
          : undefined}
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors ${
          task.done ? "bg-accent" : "border-[1.5px] border-line-strong"
        } ${linked && task.done ? "cursor-default" : ""}`}
      >
        {task.done && <Check size={12} strokeWidth={3} className="-translate-x-px text-accent-ink" />}
      </button>

      <button onClick={onOpen} title="แตะเพื่อแก้ไข" className="min-w-0 flex-1 text-left">
        <div className={`break-words text-[0.875rem] leading-normal ${task.done ? "text-ink-3 line-through" : "text-ink"}`}>
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
          {(task.recurringId || task.notes?.trim() || linked) && (
            <span className="ml-1.5 inline-flex items-center gap-1.5 align-middle text-ink-3">
              {task.recurringId && <Repeat size={12} className="text-accent-text" />}
              {task.notes?.trim() && <FileText size={12} />}
              {linked && <Link2 size={12} className="text-info" />}
            </span>
          )}
        </div>

        {(showDate || range) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.7rem] text-ink-3">
            {showDate && task.date && (
              <span className={`inline-flex items-center gap-1 ${late ? "font-semibold text-bad" : ""}`}>
                <CalendarDays size={11} /> {planDateLabel(task.date)}
              </span>
            )}
            {range && <span className="num">{range}</span>}
          </div>
        )}
      </button>

      {type && (
        <span
          className="mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold text-accent-ink"
          style={{ background: taskToneVar(type.tone) }}
        >
          {type.key}
        </span>
      )}
    </li>
  );
}
