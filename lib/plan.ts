/* The daily planner — types and pure logic.

   PORTED FROM the Klaichan/Mook CRM planner (itself ported from Solo Gang),
   2026-08-23. The rules below are carried over verbatim in behaviour,
   including the ones that look arbitrary — they are not, and the reasoning
   is kept with them so nobody "fixes" one later.

   Client-safe: pure functions and constants, no DB import. The same
   `ruleAppliesOn`/`pendingRules` pair runs on the server (the authoritative
   write) and in the browser (the optimistic preview), which is only safe
   because it lives in one file. */

export interface PlanTask {
  id: string;
  /** null = backlog. */
  date: string | null;
  title: string;
  done: boolean;
  sortOrder: number;
  /** options key, kind "task_type". */
  kind: string | null;
  /** options key, kind "action_category". When set, ticking this task logs
      the activity (0019) — the planner's own `kind` above is a colour, this
      is what the scoreboard counts. */
  actionCategory: string | null;
  /** The count you PLANNED, when the work is countable (0026). Ticking a task
      that has one asks you to confirm the real number before logging it — so
      this is an intention and `actions.quantity` is what happened. NULL means
      "no number applies", which is not the same as 0. */
  targetQuantity: number | null;
  notes: string | null;
  /** Set when a recurring rule produced this instance. */
  recurringId: string | null;
  /** 'HH:MM' or null. */
  startTime: string | null;
  endTime: string | null;
  /** The CRM record this task is a follow-up on, when it was promoted out of
      ติดตามวันนี้ (0045). Null on a hand-typed task, which is most of them.
      A linked task does not tick like an ordinary one — see
      app/(app)/plan/actions.ts `completeTask`. */
  leadId: string | null;
  listingId: string | null;
}

/** One row of the day's activity log, as the card renders it.

    Lives here rather than in the repo module because BOTH ends need it: the
    server reads it out of `actions`, and the planner hands one back when
    ticking a task logs one, so the card can splice it in without a refetch. */
export interface DayActivity {
  id: string;
  category: string;
  quantity: number | null;
  hours: string | null;
  remark: string | null;
  recap: string | null;
  /** The plan task whose tick wrote this row (0022). Removing the activity
      un-ticks that task, so the two never disagree. */
  taskId: string | null;
  /** Does this row also carry a lead's or listing's SLA stamp? Those cannot
      be removed — see `deleteActivity`. */
  linked: boolean;
}

/** Does completing this task have to write a CRM activity first? */
export function isLinked(t: PlanTask): boolean {
  return !!(t.leadId || t.listingId);
}

/** Does ticking this task write to `actions`?

    Either because it points at a lead or listing (a follow-up, which also
    resets that record's SLA clock) or because it names an action category
    (0019). Both go through completeTask, and neither un-ticks by clicking the
    box: the activity is the record, so it is removed from กิจกรรมวันนี้ and
    the task follows (0022). A follow-up cannot be removed at all — it also
    stamped a record. */
export function recordsActivity(t: PlanTask): boolean {
  return isLinked(t) || !!t.actionCategory;
}

export type RecurFreq = "daily" | "weekdays" | "weekly" | "monthly";

export interface RecurRule {
  id: string;
  title: string;
  notes: string | null;
  kind: string | null;
  /** Copied onto every instance this rule materializes. */
  actionCategory: string | null;
  /** Copied onto every instance too (0026). */
  targetQuantity: number | null;
  freq: RecurFreq;
  /** freq='weekly': comma list of JS weekday numbers. */
  weekdays: string | null;
  /** freq='monthly'. */
  dayOfMonth: number | null;
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
  active: boolean;
}

export interface DayRecap {
  date: string;
  good: string;
  lesson: string;
  tomorrow: string;
}

export interface PlanPrefs {
  /** JS weekday numbers (0=Sun … 6=Sat) that are days off every week. */
  offDays: number[];
  /** Dates the user opted a single auto day-off OUT of. */
  offDaysSkip: string[];
}

/** Everything the planner needs for one user, in one fetch. */
export interface PlanData {
  tasks: PlanTask[];
  recurring: RecurRule[];
  dayoffs: string[];
  recaps: DayRecap[];
  prefs: PlanPrefs;
}

/* ---------- vocabulary ---------------------------------------------------- */

export const RECUR_FREQS: RecurFreq[] = ["daily", "weekdays", "weekly", "monthly"];

export const RECUR_LABEL: Record<RecurFreq, string> = {
  daily: "ทุกวัน",
  weekdays: "จันทร์–ศุกร์",
  weekly: "ทุกสัปดาห์",
  monthly: "ทุกเดือน",
};

export const normalizeFreq = (f: string | null | undefined): RecurFreq =>
  RECUR_FREQS.includes(f as RecurFreq) ? (f as RecurFreq) : "daily";

/** Thai weekday initials, indexed by JS getDay(). */
export const WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
/** Monday-first, because a Thai week starts on Monday and a Sunday-first
    picker is misread every single time. */
export const WEEKDAY_PICKER_ORDER = [1, 2, 3, 4, 5, 6, 0];

/* ---------- date helpers -------------------------------------------------- */

/** Shift an ISO date by n days. Parsed at LOCAL midnight (`T00:00:00`), not
    with `new Date(iso)`, which reads the string as UTC and lands at 07:00 ICT
    — enough to shift a day near a boundary. */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** JS weekday (0=Sun … 6=Sat) for an ISO date. */
export const weekdayOf = (iso: string): number => new Date(`${iso}T00:00:00`).getDay();

const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DOW = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** '2026-08-07' → 'วันศุกร์ 7 ส.ค.' */
export function planDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `วัน${TH_DOW[d.getDay()]} ${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]}`;
}

/* ---------- ordering ------------------------------------------------------ */

/** A day's task order: timed tasks first in clock order, untimed below them
    in manual (drag) order. One definition, so the card, the ring and any
    future export all agree on what "the day's sequence" is. */
export function compareDayTasks(a: PlanTask, b: PlanTask): number {
  const at = a.startTime || "";
  const bt = b.startTime || "";
  if (at && bt && at !== bt) return at < bt ? -1 : 1;
  if (at && !bt) return -1;
  if (!at && bt) return 1;
  return (a.sortOrder || 0) - (b.sortOrder || 0);
}

/* ---------- recurrence ---------------------------------------------------- */

/** Does a rule produce a task on `date`? Inactive rules and dates before the
    rule's start never match. Pure date logic otherwise — no "now". */
export function ruleAppliesOn(rule: RecurRule, date: string): boolean {
  if (!rule?.active) return false;
  if (rule.startDate && date < rule.startDate) return false;
  switch (normalizeFreq(rule.freq)) {
    case "daily":
      return true;
    case "weekdays": {
      const w = weekdayOf(date);
      return w >= 1 && w <= 5;
    }
    case "weekly":
      return String(rule.weekdays ?? "").split(",").map((s) => s.trim()).filter(Boolean)
        .includes(String(weekdayOf(date)));
    case "monthly":
      return Number(date.slice(8, 10)) === Number(rule.dayOfMonth);
  }
}

/** Which rules still owe `date` a task: those that apply and aren't already
    materialized (deduped by recurringId on the day's existing tasks). The
    caller assigns ids and order and persists. */
export function pendingRules(rules: RecurRule[], dayTasks: PlanTask[], date: string): RecurRule[] {
  const have = new Set(dayTasks.map((t) => t.recurringId).filter(Boolean));
  return rules.filter((r) => !have.has(r.id) && ruleAppliesOn(r, date));
}

/* ---------- streaks ------------------------------------------------------- *
   The whole point of the streak is that it survives an imperfect day. Getting
   this wrong in either direction kills the feature: too strict and one missed
   errand wipes a month; too loose and it means nothing. */

/** A day counts toward the streak at 80% done, not 100%. Chosen deliberately
    over a perfect-day rule: hitting every single task daily is brittle, and
    one skipped minor task should not erase a run. A perfect day is still
    recognised separately — see `dayStatus` and the celebration. */
export const STREAK_BAR = 0.8;

export type DayStatus = "dayoff" | "none" | "partial" | "full";

/** A day's status, where 'full' means a PERFECT 100% day. Drives the
    calendar's dark cell and the celebration — do not reuse it for streaks,
    which run on the softer bar below. */
export function dayStatus(tasks: PlanTask[], dayoffs: Set<string>, date: string): DayStatus {
  if (dayoffs.has(date)) return "dayoff";
  const day = tasks.filter((t) => t.date === date);
  if (!day.length) return "none";
  return day.every((t) => t.done) ? "full" : "partial";
}

type StreakStatus = "dayoff" | "none" | "met" | "short";

function streakStatus(tasks: PlanTask[], dayoffs: Set<string>, date: string): StreakStatus {
  if (dayoffs.has(date)) return "dayoff";
  const day = tasks.filter((t) => t.date === date);
  if (!day.length) return "none";
  return day.filter((t) => t.done).length / day.length >= STREAK_BAR ? "met" : "short";
}

/** Consecutive qualifying days, walking back from the most recent.

    Two rules that are easy to get wrong:
      1. FUTURE days are excluded. Tasks planned for tomorrow are not yet
         undone; without this the walk starts on an incomplete future day and
         stops before it ever reaches today.
      2. A day off and a day with no plan BRIDGE the run — they neither extend
         nor break it. Resting is allowed; only a day that fell short breaks. */
export function streakOf(tasks: PlanTask[], dayoffs: Set<string>, today: string): number {
  const days = [...new Set(tasks.filter((t) => t.date && t.date <= today).map((t) => t.date as string))].sort();
  if (!days.length) return 0;

  let i = days.length - 1;
  // Today, if not yet at the bar, is PENDING rather than failed.
  if (days[i] === today && streakStatus(tasks, dayoffs, today) !== "met") i -= 1;

  let streak = 0;
  for (; i >= 0; i -= 1) {
    const s = streakStatus(tasks, dayoffs, days[i]);
    if (s === "met") streak += 1;
    else if (s === "dayoff" || s === "none") continue;
    else break;
  }
  return streak;
}

/** Longest run ever recorded, same lenient rule. Today, still pending,
    bridges — so an unfinished morning can't drag the record down. */
export function bestStreakOf(tasks: PlanTask[], dayoffs: Set<string>, today: string): number {
  const days = [...new Set(tasks.filter((t) => t.date && t.date <= today).map((t) => t.date as string))].sort();
  let best = 0, run = 0;
  for (const d of days) {
    const s = streakStatus(tasks, dayoffs, d);
    if (s === "met") { run += 1; if (run > best) best = run; }
    else if (s === "dayoff" || s === "none") continue;
    else if (d === today) continue;
    else run = 0;
  }
  return best;
}

/** Perfect (100%) days in an inclusive window — the tier above the streak
    bar, so a flawless day still gets its own recognition. */
export function perfectDaysBetween(tasks: PlanTask[], dayoffs: Set<string>, from: string, to: string): number {
  const days = [...new Set(tasks.filter((t) => t.date && t.date >= from && t.date <= to).map((t) => t.date as string))];
  return days.filter((d) => dayStatus(tasks, dayoffs, d) === "full").length;
}

/* ---------- quick-add time parsing ---------------------------------------- */

/** 'HH:MM' + 'HH:MM' → 'HH:MM–HH:MM'. */
export function timeRange(start: string | null, end: string | null): string {
  if (start && end) return `${start}–${end}`;
  return start || end || "";
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function toHHMM(h: string, m: string | undefined, ap: string | undefined): string | null {
  let hr = Number(h);
  const min = m ? Number(m) : 0;
  if (ap) {
    if (ap === "pm" && hr < 12) hr += 12;
    if (ap === "am" && hr === 12) hr = 0;
  }
  if (hr > 23 || min > 59) return null;
  return `${pad2(hr)}:${pad2(min)}`;
}

const TOK = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*([ap]m)?`;
const LEADING_TIME = new RegExp(`^\\s*${TOK}(?:\\s*[-–]\\s*${TOK})?(?=\\s|$)`, "i");

/** Pull a time typed in front of a task title: "9:00 คุยเจ้าของ",
    "3pm พาชม KC012", "09:00-10:30 ทำคอนเทนต์".

    DELIBERATELY CONSERVATIVE. The leading token only counts as a time when it
    is unambiguous — it must carry minutes or an am/pm. Without that rule
    "3 ห้องที่ต้องถ่ายรูป" becomes a task at 03:00 titled "ห้องที่ต้องถ่ายรูป",
    which is the kind of silent mangling that makes people stop trusting a
    quick-add box. */
export function parseLeadingTime(text: string): { title: string; startTime: string; endTime: string } {
  const raw = String(text || "");
  const m = raw.match(LEADING_TIME);
  if (!m || (!m[2] && !m[3])) return { title: raw.trim(), startTime: "", endTime: "" };

  const start = toHHMM(m[1], m[2], m[3]?.toLowerCase());
  if (!start) return { title: raw.trim(), startTime: "", endTime: "" };

  const title = raw.slice(m[0].length).trim();
  // "9:00" with nothing after it is a title, not an empty task at 9am.
  if (!title) return { title: raw.trim(), startTime: "", endTime: "" };

  let end = "";
  if (m[4]) {
    // "9am-10" borrows the start's meridiem, so the end isn't read as 10:00.
    const endAp = (m[6] || m[3] || "").toLowerCase() || undefined;
    end = toHHMM(m[4], m[5], endAp) || "";
    if (end && end < start) end = ""; // a backwards range is dropped, not stored
  }
  return { title, startTime: start, endTime: end };
}

/* ---------- celebration --------------------------------------------------- */

export interface Celebration {
  emoji: string;
  tone: "gold" | "accent";
  title: string;
  sub: string;
}

const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 100];

/** What to show when the last task of a day is ticked, escalating by what the
    streak just did: a personal best beats a milestone beats a plain 100%. */
export function dayDoneCelebration(streak: number, prevBest: number): Celebration {
  if (streak >= 3 && streak > prevBest) {
    return { emoji: "🏆", tone: "gold", title: `สถิติใหม่! ${streak} วันติด`, sub: "ทำลายสถิติเดิมของตัวเองแล้ว" };
  }
  if (STREAK_MILESTONES.includes(streak)) {
    return { emoji: "🔥", tone: "gold", title: `${streak} วันติดต่อกัน!`, sub: "โมเมนตัมกำลังมา — ทำต่อไป" };
  }
  return {
    emoji: "🎉", tone: "accent", title: "ครบ 100% ของวันนี้!",
    sub: streak > 1 ? `สตรีค ${streak} วัน` : "เริ่มสตรีคใหม่วันนี้",
  };
}

/* ---------- task types (options kind "task_type") ------------------------- */

/** The slice of an options row the planner needs — key doubles as the label
    (Habihub options store the display text AS the key). */
export interface TaskType {
  key: string;
  tone: string | null;
}

/** Tone token → the CSS variable a chip/slice paints with. Unknown or unset
    tones land on the muted ink rather than vanishing. */
export function taskToneVar(tone: string | null | undefined): string {
  switch (tone) {
    case "accent": return "var(--accent)";
    case "good": return "var(--good)";
    case "warn": return "var(--warn)";
    case "bad": return "var(--bad)";
    case "info": return "var(--info)";
    default: return "var(--ink-3)";
  }
}
