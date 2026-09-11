// Display formatting — Thai locale (Buddhist-era dates, ฿ prices) and
// Asia/Bangkok day math. All date columns are plain `date` strings; day
// arithmetic must never touch the machine's local timezone.

const BAHT = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

export function formatBaht(v: string | number | null | undefined): string {
  const n = toNumber(v);
  return n === null ? "—" : `฿${BAHT.format(n)}`;
}

/** Axis//tick density: ฿10,200,000 → "10.2 ลบ.", ฿450,000 → "450K".

    Ported from the Klaichan CRM formatter with the chart card it serves. Only
    for axes and tick labels, where the full formatBaht() would collide with
    its neighbours — never for a figure someone reads as the number. */
export function bahtShort(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0$/, "")} ลบ.`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("th-TH")}K`;
  return n.toLocaleString("th-TH");
}

export function formatNum(v: string | number | null | undefined): string {
  const n = toNumber(v);
  return n === null ? "—" : NUM.format(n);
}

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

const DATE_FMT = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC", // date-only values are UTC-midnight; keep the calendar day
});

const DATETIME_FMT = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

/** "2026-08-15" | Date → "15 ส.ค. 2569" (Buddhist era, Thai convention). */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(`${d}T00:00:00Z`) : d;
  return Number.isNaN(date.getTime()) ? "—" : DATE_FMT.format(date);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? "—" : DATETIME_FMT.format(date);
}

const BKK_DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
});

/** A timestamp's calendar date in Asia/Bangkok as "YYYY-MM-DD" — the JS twin
 *  of SQL's `(ts at time zone 'Asia/Bangkok')::date`. */
export function bkkDate(d: Date): string {
  return BKK_DAY_FMT.format(d);
}

/** Today's calendar date in Asia/Bangkok as "YYYY-MM-DD". */
export function bkkToday(): string {
  return bkkDate(new Date());
}

/** Whole days from `d` (YYYY-MM-DD) to `today`; null if `d` is empty. */
export function daysSince(
  d: string | null | undefined,
  today: string = bkkToday()
): number | null {
  if (!d) return null;
  const from = Date.parse(`${d}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

/** "3 วันก่อน" / "วันนี้" for follow-up columns. */
export function daysAgoLabel(d: string | null | undefined): string {
  const days = daysSince(d);
  if (days === null) return "—";
  if (days <= 0) return "วันนี้";
  return `${days} วันก่อน`;
}

/* ── activity timestamps ───────────────────────────────────────────────── */

const BKK_TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Bangkok",
});

/** A timestamp's clock time in Bangkok — "14:32". */
export function bkkTime(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? null : BKK_TIME_FMT.format(date);
}

/**
 * The two-line stamp on an activity entry: which day, and the clock time.
 *
 * TIME IS SHOWN ONLY WHEN THE ROW WAS WRITTEN ON THE DAY IT HAPPENED.
 * `actions.date` is the day the work happened and `created_at` is the moment
 * the row was inserted, and for the imported sheet history those are months
 * apart — printing the import's 03:14 beside a real August date would invent
 * a fact. Same for an entry back-dated by hand. When the two disagree the day
 * stands alone, which is all the old data ever knew.
 *
 * `today` IS PASSED IN, never read from the clock here. This runs in the
 * browser as well as on the server, and "what day is it" is the one input
 * those two disagree about — the server is UTC, the office is Bangkok. A
 * relative label computed independently on each side is a hydration mismatch
 * every evening between 17:00 and midnight ICT.
 */
export function activityStamp(
  date: string,
  createdAt: Date | string | null | undefined,
  today: string
): { day: string; time: string | null } {
  const days = daysSince(date, today);
  const day =
    days === 0 ? "วันนี้" : days === 1 ? "เมื่อวาน" : formatDate(date);
  const sameDay =
    createdAt != null && bkkDate(new Date(createdAt)) === date;
  return { day, time: sameDay ? bkkTime(createdAt) : null };
}
