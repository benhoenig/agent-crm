/* ช่วงเวลา — the month-range vocabulary behind the team dashboard's filter.

   CLIENT-SAFE ON PURPOSE (no DB import, no "server-only"). The picker is a
   client component and the repository layer turns the same keys into date
   bounds; one spelling of "YYYY-MM" shared by both is what stops the URL and
   the query drifting apart silently.

   A MONTH IS THE UNIT, not a free from/to date pair, and that is a business
   decision rather than a simplification. Commission is booked on a closing
   date and read monthly, targets are set per month (lib/targets.ts), and a
   heatmap row is a calendar day inside a calendar month. A 17-day window
   would have no target to score against and no honest way to make one.

   Ported from the Habihub Sales Dashboard's MonthRangePicker + hooks/months.js
   (Ben, 2026-08-28), where the same picker drives the whole Overview tab. */

export type MonthKey = string; // "YYYY-MM"

export interface MonthRange {
  from: MonthKey;
  to: MonthKey;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(s: string): boolean {
  return MONTH_RE.test(s);
}

/** "2026-08-15" → "2026-08". */
export function monthKeyOf(date: string): MonthKey {
  return date.slice(0, 7);
}

/* Pure string arithmetic, never Date maths: every caller here is working in
   Asia/Bangkok calendar terms and constructing a JS Date would reintroduce
   the machine's zone at exactly the boundary that matters (the 1st). */
export function addMonths(key: MonthKey, n: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** How many months a range covers — the multiplier a monthly target is
    scaled by to cover the selected span. */
export const MAX_SPAN = 36;

export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  // Lexical compare is safe: "YYYY-MM" is zero-padded and fixed-width.
  let k = from > to ? to : from;
  const end = from > to ? from : to;
  for (let i = 0; i < MAX_SPAN && k <= end; i++) {
    out.push(k);
    k = addMonths(k, 1);
  }
  return out.length ? out : [from];
}

/** The equal-length span immediately before this one — what the hero's
    delta compares against. Two months back two months, not "last month". */
export function previousRange(range: MonthRange): MonthRange {
  const n = monthsBetween(range.from, range.to).length;
  return { from: addMonths(range.from, -n), to: addMonths(range.to, -n) };
}

/** First day of the month, as the `date` columns store it. */
export function monthStart(key: MonthKey): string {
  return `${key}-01`;
}

/** Exclusive upper bound — the 1st of the following month. Half-open ranges
    everywhere, so a deal closed on the 31st is never dropped by a `<=` that
    forgot the month's length. */
export function monthEndExclusive(key: MonthKey): string {
  return monthStart(addMonths(key, 1));
}

export function daysInMonth(key: MonthKey): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const THAI_MONTH = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** Buddhist era, matching lib/format.ts formatDate — "2026-08" → "ส.ค. 2569". */
export function monthLabel(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  return `${THAI_MONTH[m - 1] ?? key} ${y + 543}`;
}

/** Axis-density twin: bare month, with the BE year appended in January so a
    12-month window crossing new year does not read as one flat stretch. */
export function monthTick(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  const label = THAI_MONTH[m - 1] ?? key;
  return m === 1 ? `${label} ${String(y + 543).slice(2)}` : label;
}

export function rangeLabel(range: MonthRange): string {
  if (range.from === range.to) return monthLabel(range.from);
  const [fy, fm] = range.from.split("-").map(Number);
  const [ty] = range.to.split("-").map(Number);
  return fy === ty
    ? `${THAI_MONTH[fm - 1]} – ${monthLabel(range.to)}`
    : `${monthLabel(range.from)} – ${monthLabel(range.to)}`;
}

export interface MonthPreset extends MonthRange {
  id: string;
  label: string;
}

/** `today` is passed in rather than read from the clock: the picker is a
    client component and the server already knows the Asia/Bangkok date. Two
    clocks would put the browser's midnight in charge of which month is
    "this" one. */
export function monthPresets(today: string): MonthPreset[] {
  const cur = monthKeyOf(today);
  const prev = addMonths(cur, -1);
  return [
    { id: "this", label: "เดือนนี้", from: cur, to: cur },
    { id: "last", label: "เดือนก่อน", from: prev, to: prev },
    { id: "q", label: "3 เดือน", from: addMonths(cur, -2), to: cur },
    { id: "h", label: "6 เดือน", from: addMonths(cur, -5), to: cur },
    { id: "ytd", label: "ปีนี้", from: `${cur.slice(0, 4)}-01`, to: cur },
  ];
}

/** The months the dropdowns offer, newest first. Bounded at the current
    month — there is no data in the future and a range ending there would
    make every average wrong. */
export function availableMonths(today: string, back = 23): MonthKey[] {
  const cur = monthKeyOf(today);
  return Array.from({ length: back + 1 }, (_, i) => addMonths(cur, -i));
}

/** Read the range out of the URL, clamped to something answerable.

    Defaults to the current month alone, which is the question the dashboard
    is asked most ("how are we doing right now"). A hand-edited or stale URL
    degrades to that default rather than erroring — this is a filter, not an
    identifier. */
export function parseMonthRange(
  raw: { from?: string; to?: string },
  today: string
): MonthRange {
  const cur = monthKeyOf(today);
  const clamp = (k: string | undefined, fallback: MonthKey): MonthKey =>
    k && isMonthKey(k) && k <= cur ? k : fallback;
  const to = clamp(raw.to, cur);
  const from = clamp(raw.from, to);
  return from > to ? { from: to, to } : { from, to };
}
