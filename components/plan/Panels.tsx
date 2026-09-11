"use client";

/* The plan card's secondary panels: the day-off control, the recap, the
   backlog, and the list of repeating rules. Kept together because each is
   30–60 lines and none is reused anywhere else — one file per panel would be
   four imports for one card. */

import { useState } from "react";
import { Sun, ChevronDown, Repeat, Trash2, Sparkles, Lightbulb, ArrowRight } from "lucide-react";
import { RECUR_LABEL, WEEKDAY_LABELS, WEEKDAY_PICKER_ORDER, type DayRecap, type RecurRule } from "@/lib/plan";
import type { TaskType } from "@/lib/plan";
import { TodoList } from "./TodoList";
import type { Planner } from "./usePlanner";

/* ---------- day off ------------------------------------------------------- */

export function DayOffPanel({ planner }: { planner: Planner }) {
  const { isDayOff, isRuleOff, offDays, toggleDayOff, toggleWeeklyOffDay } = planner;
  const [showRule, setShowRule] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={toggleDayOff}
        aria-pressed={isDayOff}
        className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[0.8rem] font-semibold transition-colors ${
          isDayOff ? "bg-info text-white" : "border border-line text-ink-2 hover:text-ink"
        }`}
      >
        <Sun size={15} /> {isDayOff ? "เป็นวันหยุด" : "ทำเครื่องหมายวันหยุด"}
      </button>

      {isDayOff && (
        <p className="mt-2 text-[0.72rem] text-ink-3">
          {isRuleOff
            ? "วันหยุดประจำสัปดาห์ · แตะปุ่มด้านบนถ้าจะทำงานวันนี้แทน"
            : "สตรีคของคุณจะไม่ขาด · ยังวางแผนได้ตามปกติ"}
        </p>
      )}

      <button
        onClick={() => setShowRule((s) => !s)}
        aria-expanded={showRule}
        className="mt-2.5 flex items-center gap-1 text-[0.72rem] font-semibold text-ink-2 transition-colors hover:text-ink"
      >
        วันหยุดประจำทุกสัปดาห์{offDays.length ? ` · ${offDays.length} วัน` : ""}
        <ChevronDown size={13} className={`transition-transform ${showRule ? "rotate-180" : ""}`} />
      </button>

      {showRule && (
        <div className="mt-2.5">
          <p className="mb-2 text-[0.72rem] text-ink-3">เลือกวันที่จะเป็นวันหยุดอัตโนมัติทุกสัปดาห์</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_PICKER_ORDER.map((wd) => {
              const on = offDays.includes(wd);
              return (
                <button
                  key={wd}
                  onClick={() => toggleWeeklyOffDay(wd)}
                  aria-pressed={on}
                  className={`h-10 w-10 rounded-xl text-[0.8rem] font-semibold transition-colors ${
                    on ? "bg-info text-white" : "border border-line text-ink-2"
                  }`}
                >
                  {WEEKDAY_LABELS[wd]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- recap --------------------------------------------------------- */

/** Three prompts, no share toggle.

    The upstream recap could publish to a team feed; Habihub has no feed,
    so the toggle would be a switch that does nothing. `tomorrow` is the one
    field that pays for the exercise — it comes back as the CarryBanner on top
    of the next day's plan. */
export function RecapPanel({ recap, onChange }: {
  recap: DayRecap;
  onChange: (patch: Partial<Pick<DayRecap, "good" | "lesson" | "tomorrow">>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <RecapField
        icon={<Sparkles size={13} className="text-accent-text" />}
        label="สิ่งดี ๆ หนึ่งอย่างของวันนี้"
        value={recap.good}
        placeholder="วันนี้มีอะไรดี ๆ บ้าง…"
        onChange={(good) => onChange({ good })}
      />
      <RecapField
        icon={<Lightbulb size={13} className="text-warn" />}
        label="บทเรียนหนึ่งข้อที่ได้เรียนรู้"
        value={recap.lesson}
        placeholder="ได้เรียนรู้อะไรวันนี้…"
        onChange={(lesson) => onChange({ lesson })}
      />
      <RecapField
        icon={<ArrowRight size={13} className="text-info" />}
        label="หนึ่งสิ่งที่จะลองทำพรุ่งนี้"
        value={recap.tomorrow}
        placeholder="พรุ่งนี้จะลองทำอะไร… (จะแสดงให้เห็นในวันพรุ่งนี้)"
        onChange={(tomorrow) => onChange({ tomorrow })}
      />
    </div>
  );
}

function RecapField({ icon, label, value, placeholder, onChange }: {
  icon: React.ReactNode; label: string; value: string; placeholder: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink-2">{icon} {label}</div>
      {/* text-base (16px) — iOS Safari zooms the page on any focused field
          under 16px, and this one is written on a phone at the end of a day. */}
      <textarea
        rows={2}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-base leading-relaxed text-ink outline-none transition-colors focus:border-accent"
      />
    </div>
  );
}

/* ---------- backlog ------------------------------------------------------- */

/** Undated capture. A backlog item is just a task with no date — no separate
    table and no `backlog` flag, so scheduling one is a date stamp rather than
    a move between two lists that could disagree. */
export function BacklogPanel({
  planner,
  taskTypes,
  actionCategories = [],
}: {
  planner: Planner;
  taskTypes: TaskType[];
  actionCategories?: string[];
}) {
  const { backlogTasks, updateTask, removeTask, addToBacklog, scheduleToPlan, scheduleAt } = planner;
  return (
    <TodoList
      tasks={backlogTasks}
      taskTypes={taskTypes}
      actionCategories={actionCategories}
      onUpdate={updateTask}
      onDelete={removeTask}
      onAdd={addToBacklog}
      onSchedule={scheduleToPlan}
      onScheduleAt={scheduleAt}
      placeholder="จดไว้ก่อน ยังไม่ลงวัน…"
      emptyText="ว่าง — จดงานที่ยังไม่ได้จัดเวลาไว้ที่นี่"
    />
  );
}

/* ---------- recurring rules ----------------------------------------------- */

/** The rules behind the 🔁 tasks. Shown so a repeat is never a mystery: if a
    task keeps appearing, this is where it comes from and where it stops.

    Stopping and deleting are separate, and both are offered. Stopping keeps
    the rule (inactive) so past instances still resolve their origin; deleting
    removes it, and the instances it already wrote stay behind as ordinary
    tasks — which is why `recurring_id` is not a foreign key. */
export function RecurringPanel({ rules, onStop, onDelete }: {
  rules: RecurRule[];
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!rules.length) {
    return (
      <p className="text-[0.8rem] text-ink-3">
        ยังไม่มีงานที่ทำซ้ำ — เพิ่มงานแล้วเลือก “ทำซ้ำ” ในหน้ารายละเอียด
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {rules.map((r) => (
        <li key={r.id} className="flex items-center gap-2.5 py-2.5">
          <Repeat size={14} className={`shrink-0 ${r.active ? "text-accent-text" : "text-ink-3"}`} />
          <div className="min-w-0 flex-1">
            <div className={`truncate text-[0.85rem] ${r.active ? "text-ink" : "text-ink-3 line-through"}`}>
              {r.title}
            </div>
            <div className="text-[0.7rem] text-ink-3">{describe(r)}</div>
          </div>
          {r.active ? (
            <button
              onClick={() => onStop(r.id)}
              className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[0.7rem] font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              หยุด
            </button>
          ) : (
            <span className="shrink-0 text-[0.7rem] text-ink-3">หยุดแล้ว</span>
          )}
          <button
            onClick={() => onDelete(r.id)}
            aria-label="ลบกฎการทำซ้ำ"
            title="ลบกฎ — งานที่สร้างไปแล้วยังอยู่"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function describe(r: RecurRule): string {
  if (r.freq === "weekly") {
    const days = String(r.weekdays ?? "").split(",").filter(Boolean).map((n) => WEEKDAY_LABELS[Number(n)]);
    return `${RECUR_LABEL.weekly} · ${days.join(" ")}`;
  }
  if (r.freq === "monthly") return `${RECUR_LABEL.monthly} · วันที่ ${r.dayOfMonth}`;
  return RECUR_LABEL[r.freq];
}
