"use client";

/* แผนประจำวัน — the daily plan, as one card.

   Ported from Solo Gang's DailyPlanCard. All the state lives in usePlanner —
   owned by PlanColumn and passed in, because the backlog card below shares
   it — so this file is layout: the date nav and completion ring, then the
   day's list, with ทำซ้ำ and สรุปวัน behind tabs rather than stacked.

   THE TABS ARE THE ONE REAL DEPARTURE. Solo Gang gives each of those its own
   full-width card because the planner IS its whole app. Here the plan shares
   a dashboard with revenue and pipeline, and extra cards push every business
   number below the fold on a phone. รายการรอ earned its own card back
   (2026-08-07) because a backlog behind a tab stops being written to; the
   repeat rules and the recap did not — those are opened on purpose. */

import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import { PlanCard } from "./Bits";
import type { TaskType } from "@/lib/plan";
import { addDays, planDateLabel } from "@/lib/plan";
import { RingProgress, TaskRatioBar, Celebration, CarryBanner } from "./Bits";
import { TodoList } from "./TodoList";
import { MiniCalendar } from "./MiniCalendar";
import { DayOffPanel, RecapPanel, RecurringPanel } from "./Panels";
import type { Planner } from "./usePlanner";

type Tab = "plan" | "repeat" | "recap";

export function DailyPlanCard({
  planner,
  taskTypes,
  /** action_category keys for the detail sheet's activity picker (0019). */
  actionCategories = [],
}: {
  planner: Planner;
  taskTypes: TaskType[];
  actionCategories?: string[];
}) {
  const [tab, setTab] = useState<Tab>("plan");

  const {
    planDate, today, dayTasks, donePct, doneCount,
    carryTomorrow, celebration, clearCelebration, taskError, clearTaskError,
    addTask, updateTask, removeTask, reorder, createRule, stopRule, deleteRule,
    recurring, dayRecap, updateRecap, isDayOff,
  } = planner;

  const activeRules = recurring.filter((r) => r.active).length;

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "plan", label: "แผนวันนี้" },
    { key: "repeat", label: "ทำซ้ำ", badge: activeRules },
    { key: "recap", label: "สรุปวัน" },
  ];

  return (
    <PlanCard>
      <Celebration event={celebration} onDone={clearCelebration} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <DateNav planner={planner} />
        <RingProgress pct={donePct} />
      </div>

      <div className="mb-3.5 text-[0.75rem] text-ink-2">
        {isDayOff && dayTasks.length === 0
          ? "วันหยุด — พักได้เต็มที่ สตรีคไม่ขาด"
          : dayTasks.length
            ? `เสร็จ ${doneCount} จาก ${dayTasks.length}`
            : "ยังไม่มีแผนสำหรับวันนี้"}
      </div>

      {/* Tabs. `overflow-x-auto` + no-scrollbar rather than wrapping — a
          wrapped pill row turns into a two-line blob at 375px. */}
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={on}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-medium transition-colors ${
                on ? "bg-accent text-accent-ink" : "bg-surface-3 text-ink-2 hover:text-ink"
              }`}
            >
              {t.label}
              {!!t.badge && (
                <span className={`num rounded-full px-1.5 text-[0.65rem] font-bold ${on ? "bg-white/20" : "bg-surface text-ink-2"}`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* The planner's only visible failure. A linked task's tick writes a CRM
          activity first, so when that write is refused the checkbox rolls back
          — and a box that silently un-ticks itself reads as a bug rather than
          as "nothing was saved". Dismissible, above the list it refers to. */}
      {taskError && (
        <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl bg-bad-soft px-3 py-2 text-[0.75rem] text-bad">
          <AlertTriangle size={14} className="mt-px shrink-0" />
          <span className="flex-1">{taskError}</span>
          <button onClick={clearTaskError} aria-label="ปิด" className="shrink-0 font-semibold hover:underline">
            ปิด
          </button>
        </div>
      )}

      {tab === "plan" && (
        <>
          {carryTomorrow && <CarryBanner text={carryTomorrow} onAdd={() => addTask(carryTomorrow)} />}
          <DayOffPanel planner={planner} />
          <TaskRatioBar tasks={dayTasks} types={taskTypes} />
          <TodoList
            tasks={dayTasks}
            taskTypes={taskTypes}
            actionCategories={actionCategories}
            onUpdate={updateTask}
            onDelete={removeTask}
            onAdd={addTask}
            onCreateRecurring={createRule}
            onStopRecurring={stopRule}
            onReorder={reorder}
          />
        </>
      )}

      {tab === "repeat" && <RecurringPanel rules={recurring} onStop={stopRule} onDelete={deleteRule} />}

      {tab === "recap" && (
        <>
          <p className="mb-3 text-[0.75rem] text-ink-3">
            บันทึกของ {planDateLabel(planDate)} · เห็นคนเดียว
          </p>
          <RecapPanel recap={dayRecap} onChange={updateRecap} />
        </>
      )}

      {/* A day in the future can be planned but not recapped — there is
          nothing to reflect on yet, and writing one now would surface as
          "เมื่อวานตั้งใจจะลอง" on a day that hasn't happened. */}
      {tab === "recap" && planDate > today && (
        <p className="mt-3 rounded-xl bg-surface-3 px-3 py-2 text-[0.72rem] text-ink-2">
          วันนี้ยังมาไม่ถึง — บันทึกสรุปเมื่อจบวันจะตรงกว่า
        </p>
      )}
    </PlanCard>
  );
}

/* ---------- date nav ------------------------------------------------------ */

function DateNav({ planner }: { planner: Planner }) {
  const { planDate, setPlanDate, today, allTasks, dayoffs } = planner;
  const [open, setOpen] = useState(false);

  const rel = planDate === today ? "วันนี้"
    : planDate === addDays(today, 1) ? "พรุ่งนี้"
    : planDate === addDays(today, -1) ? "เมื่อวาน"
    : null;

  const navBtn = "grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-line text-ink-2 transition-colors hover:text-accent-text";

  return (
    <div className="relative flex min-w-0 items-center gap-2">
      <button onClick={() => setPlanDate(addDays(planDate, -1))} aria-label="วันก่อนหน้า" className={navBtn}>
        <ChevronLeft size={16} />
      </button>

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="เลือกวันที่"
        aria-expanded={open}
        className="flex min-w-0 items-center gap-1 text-left"
      >
        <div className="min-w-0">
          <div className="text-[0.68rem] text-ink-2">แผนประจำวัน{rel ? ` · ${rel}` : ""}</div>
          <div className="whitespace-nowrap text-[1.05rem] font-semibold leading-tight">{planDateLabel(planDate)}</div>
        </div>
        <ChevronDown size={15} className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <button onClick={() => setPlanDate(addDays(planDate, 1))} aria-label="วันถัดไป" className={navBtn}>
        <ChevronRight size={16} />
      </button>

      {planDate !== today && (
        <button
          onClick={() => setPlanDate(today)}
          className="shrink-0 rounded-full border border-accent px-3 py-1 text-[0.72rem] font-semibold text-accent-text"
        >
          วันนี้
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[19rem] max-w-[calc(100vw-3rem)] rounded-lg bg-surface p-3.5 border border-line-strong shadow-xl">
            <MiniCalendar
              tasks={allTasks}
              dayoffs={dayoffs}
              planDate={planDate}
              onPick={(d) => { setPlanDate(d); setOpen(false); }}
            />
          </div>
        </>
      )}
    </div>
  );
}
