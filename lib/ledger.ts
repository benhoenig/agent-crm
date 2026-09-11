/* The cash ledger's pure logic — money maths and the P&L builder. Ported from
   the Klaichan/Mook CRM ledger (proven against a real year of an agency's
   books) and adapted to Habihub's options catalog.

   Money is SATANG here, everywhere, with no exceptions. Formatting to baht
   happens at the edge (`baht()`); nothing upstream of the render should ever
   hold a fractional amount. */

/** Which P&L block a ledger category rolls into. Fixed vocabulary owned by
    the app — the sections are what a profit statement IS; the client renames
    the lines inside them, never the shape.

    `financing` is money that moved the bank balance without being trade —
    a director's loan is not revenue, and counting it as such overstates
    gross profit. It shows in the ledger and as its own block, and is left
    out of every profit figure. */
export type LedgerSection =
  | "revenue"
  | "cogs"
  | "fixed"
  | "variable"
  | "growth"
  | "financing";

export const LEDGER_SECTIONS: {
  key: LedgerSection;
  title: string;
  hint: string;
}[] = [
  { key: "revenue", title: "รายได้", hint: "เงินเข้าจากค่าคอมมิชชั่นและรายได้อื่น" },
  { key: "cogs", title: "ต้นทุนการขาย", hint: "ค่าใช้จ่ายที่ผูกกับดีลโดยตรง — ส่วนแบ่งคอม โบนัส ค่าธรรมเนียม" },
  { key: "fixed", title: "ค่าใช้จ่ายคงที่", hint: "จ่ายเท่าเดิมทุกเดือนไม่ว่าจะขายได้หรือไม่ — เงินเดือน ประกันสังคม" },
  { key: "variable", title: "ค่าใช้จ่ายผันแปร", hint: "ค่าการตลาดและค่าดำเนินงานที่ขึ้นลงได้" },
  { key: "growth", title: "ลงทุนเพื่อเติบโต", hint: "แบรนด์ ระบบ เครื่องมือ — จ่ายวันนี้เพื่อผลปีหน้า" },
  { key: "financing", title: "เงินทุน / เงินกู้", hint: "เงินกู้ เงินลงทุนของเจ้าของ การถอนทุน — ไม่ใช่รายได้ ไม่นับในกำไร" },
];

export function isLedgerSection(v: unknown): v is LedgerSection {
  return LEDGER_SECTIONS.some((s) => s.key === v);
}

/* ---------------- money ---------------- */

/** "12,345.67" — the ledger's only rendering of an amount. Always two
    decimals: a column of money that sometimes shows them and sometimes does
    not is a column nobody can scan. */
export function baht(satang: number): string {
  const sign = satang < 0 ? "-" : "";
  const abs = Math.abs(satang);
  return `${sign}${Math.floor(abs / 100).toLocaleString("th-TH")}.${String(
    abs % 100
  ).padStart(2, "0")}`;
}

/** Parse what gets typed — "23,277.85", "฿1,000", "1000" — into satang.
    Returns null for anything that isn't a number, so the caller can refuse
    rather than silently store 0. */
export function toSatang(input: string): number | null {
  const cleaned = input.replace(/[,\s฿]/g, "");
  if (!cleaned || !/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** numeric(12,2) baht string (drizzle) → satang. */
export function bahtStrToSatang(v: string | null): number | null {
  if (v == null) return null;
  return toSatang(v);
}

/* ---------------- P&L ---------------- */

export interface PLRowInput {
  date: string; // ISO
  direction: "in" | "out";
  amountSatang: number; // positive
  category: string | null;
  isAnnual: boolean;
  annualMonths: number;
}

/** One line of the statement — a category, its twelve months, its total. */
export interface PLLine {
  category: string;
  months: number[]; // index 0 = January, satang
  total: number;
}

export interface PLBlock {
  section: LedgerSection;
  title: string;
  lines: PLLine[];
  months: number[];
  total: number;
}

export interface ProfitAndLoss {
  year: number;
  blocks: PLBlock[];
  revenue: number[];
  cogs: number[];
  grossProfit: number[];
  operatingExpenses: number[]; // fixed + variable + growth
  netProfit: number[];
  totals: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
  };
  /** Rows with no (sectioned) category — excluded from every figure above and
      reported, so the statement can never quietly under-report. */
  uncategorised: { count: number; totalIn: number; totalOut: number };
}

const zero12 = () => Array<number>(12).fill(0);
const add12 = (a: number[], b: number[]) => a.map((n, i) => n + b[i]);
const sum12 = (a: number[]) => a.reduce((n, x) => n + x, 0);

/** How much of `t` lands in each month of `year`.

    An ordinary row lands entirely in its own month. An ANNUAL row is spread
    evenly across `annualMonths` starting from its date — a portal credit
    bought in January is a cost of doing business all year. The remainder from
    an uneven division goes to the first month, so the shares always add back
    to the exact amount. */
export function monthlyShare(t: PLRowInput, year: number): number[] {
  const out = zero12();
  const start = new Date(t.date);
  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth();

  if (!t.isAnnual) {
    if (startYear === year) out[startMonth] += t.amountSatang;
    return out;
  }

  const n = Math.max(1, t.annualMonths);
  const per = Math.floor(t.amountSatang / n);
  const remainder = t.amountSatang - per * n;

  for (let i = 0; i < n; i++) {
    const m = startMonth + i;
    const y = startYear + Math.floor(m / 12);
    if (y !== year) continue;
    out[m % 12] += per + (i === 0 ? remainder : 0);
  }
  return out;
}

/** Build the statement for one year. Uncategorised (or section-less) rows are
    excluded and counted separately — an untagged row must never silently
    contribute nothing without something saying so. */
export function buildProfitAndLoss(
  rows: PLRowInput[],
  year: number,
  categories: { key: string; section?: string | null }[]
): ProfitAndLoss {
  const sectionByKey = new Map(
    categories
      .filter((c) => isLedgerSection(c.section))
      .map((c) => [c.key, c.section as LedgerSection])
  );
  const lines = new Map<string, PLLine>();
  const uncategorised = { count: 0, totalIn: 0, totalOut: 0 };

  for (const t of rows) {
    const section = t.category ? sectionByKey.get(t.category) : undefined;
    if (!section) {
      if (new Date(t.date).getUTCFullYear() === year) {
        uncategorised.count += 1;
        if (t.direction === "in") uncategorised.totalIn += t.amountSatang;
        else uncategorised.totalOut += t.amountSatang;
      }
      continue;
    }
    /* Direction against the section's natural sign: a refund into an expense
       category REDUCES that expense; money out of a revenue category reduces
       revenue. The pair nets to nothing, which is what actually happened. */
    const natural = section === "revenue" || section === "financing" ? "in" : "out";
    const sign = t.direction === natural ? 1 : -1;

    const share = monthlyShare(t, year).map((n) => n * sign);
    if (!share.some((n) => n !== 0)) continue;

    let line = lines.get(t.category!);
    if (!line) {
      line = { category: t.category!, months: zero12(), total: 0 };
      lines.set(t.category!, line);
    }
    line.months = add12(line.months, share);
    line.total = sum12(line.months);
  }

  const blocks: PLBlock[] = LEDGER_SECTIONS.map((s) => {
    const own = [...lines.values()].filter(
      (l) => sectionByKey.get(l.category) === s.key
    );
    const months = own.reduce((acc, l) => add12(acc, l.months), zero12());
    return { section: s.key, title: s.title, lines: own, months, total: sum12(months) };
  });

  const block = (k: LedgerSection) =>
    blocks.find((b) => b.section === k)?.months ?? zero12();
  const revenue = block("revenue");
  const cogs = block("cogs");
  const grossProfit = revenue.map((n, i) => n - cogs[i]);
  const operatingExpenses = add12(add12(block("fixed"), block("variable")), block("growth"));
  const netProfit = grossProfit.map((n, i) => n - operatingExpenses[i]);

  return {
    year,
    // Empty blocks are dropped: five headings with nothing under four of them
    // reads as broken rather than as early days.
    blocks: blocks.filter((b) => b.lines.length > 0),
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    netProfit,
    totals: {
      revenue: sum12(revenue),
      cogs: sum12(cogs),
      grossProfit: sum12(grossProfit),
      operatingExpenses: sum12(operatingExpenses),
      netProfit: sum12(netProfit),
    },
    uncategorised,
  };
}

export const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
