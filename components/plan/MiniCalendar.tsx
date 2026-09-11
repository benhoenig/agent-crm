"use client";

/* Month picker for the plan card's date popover.

   Ported from Solo Gang's MiniCalendar. Exists so planning a week out isn't
   seven taps on ▶ — and because the status dot turns the picker into a
   glance at the month: which days were finished, which fell short, which were
   days off. That read is the reason it browses months rather than being a
   plain <input type="date">.

   Monday-first. A Sunday-first Thai calendar is misread every time. */

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayStatus, addDays, type PlanTask } from "@/lib/plan";
import { bkkToday } from "@/lib/format";

const DOW = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const prevMonth = (m: string) => addDays(`${m}-01`, -1).slice(0, 7);
function nextMonth(m: string): string {
  let [y, mo] = m.split("-").map(Number);
  mo += 1;
  if (mo > 12) { mo = 1; y += 1; }
  return `${y}-${String(mo).padStart(2, "0")}`;
}
const monthLabel = (m: string) => `${TH_MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Dot colour per day status. `partial` is amber, not red: a day that got
    some of the way is not a failure, and painting it red makes the calendar
    read as a wall of blame. */
const DOT: Record<string, string> = {
  full: "var(--good)",
  partial: "var(--warn)",
  dayoff: "var(--info)",
  none: "transparent",
};

export function MiniCalendar({
  tasks, dayoffs, planDate, onPick,
}: {
  tasks: PlanTask[];
  dayoffs: Set<string>;
  planDate: string;
  onPick: (date: string) => void;
}) {
  const today = bkkToday();
  // Seeded from the day being planned, so the popover opens on the month you
  // are already in rather than always on this one.
  const [month, setMonth] = useState(planDate.slice(0, 7));

  const days = daysOf(month);
  // Blanks before the 1st, Monday-first: JS getDay() is Sunday-first, so
  // (day + 6) % 7 rotates it.
  const lead = (new Date(`${month}-01T00:00:00`).getDay() + 6) % 7;

  const navBtn = "grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-line text-ink-2 transition-colors hover:text-accent-text";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={() => setMonth(prevMonth(month))} aria-label="เดือนก่อนหน้า" className={navBtn}><ChevronLeft size={16} /></button>
        <div className="whitespace-nowrap text-[0.875rem] font-bold text-ink">{monthLabel(month)}</div>
        <button onClick={() => setMonth(nextMonth(month))} aria-label="เดือนถัดไป" className={navBtn}><ChevronRight size={16} /></button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DOW.map((d) => (
          <div key={d} className="py-0.5 text-center text-[0.65rem] font-semibold text-ink-3">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
        {days.map((date) => {
          const status = dayStatus(tasks, dayoffs, date);
          const count = tasks.filter((t) => t.date === date).length;
          const isToday = date === today;
          const selected = date === planDate;
          return (
            <button
              key={date}
              onClick={() => onPick(date)}
              title={`${date}${count ? ` · ${count} งาน` : ""}`}
              className={`flex h-10 w-full flex-col items-center justify-center gap-1 rounded-xl text-[0.8rem] transition-colors ${
                selected ? "border-2 border-accent bg-accent-soft font-bold"
                  : isToday ? "border border-accent font-bold"
                  : "border border-line"
              }`}
            >
              <span className="num leading-none">{Number(date.slice(8, 10))}</span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: DOT[status] }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Every ISO date in a 'YYYY-MM'. Day 0 of the next month is the last day of
    this one, so leap years need no special case. */
function daysOf(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}
