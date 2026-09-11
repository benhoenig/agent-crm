"use client";

/* แนวโน้มรายได้ — commission from closed deals per month, last 12.
//
   PORTED FROM the Klaichan CRM trend card, 2026-08-28, replacing the
   hand-rolled div bars that stood here. Those bars were a deliberate choice
   ("twelve bars do not justify a dependency") and the choice is now reversed
   on Ben's call: an area chart with a real y-axis, a curve through every
   reading and a tooltip is not something worth re-implementing badly, and
   recharts is what Klaichan's already is.

   NOT DRIVEN BY ANY RANGE FILTER, on purpose. A trend needs a span longer
   than the thing being filtered: "เดือนนี้" would collapse this to a single
   point, and a one-point line chart is a stat tile with extra chrome. The
   subtitle says so rather than leaving the reader to notice.

   Design decisions, carried over from Klaichan:
     - ONE series at a time. Baht and deal-count cannot share a y-axis, so the
       toggle SWITCHES the series instead of overlaying them. No dual axis.
     - One series → no legend box; the title names it.
     - A table view sits behind a toggle, so no value is reachable only by
       hovering.

   WHAT IS DELIBERATELY MISSING vs Klaichan: her chart draws a dashed
   ReferenceLine at the MONTHLY target. Habihub has no monthly target to draw.
   A goal here carries its own [startDate, targetDate] window (lib/repo/
   goals.ts, and see TargetRevenueCard's note), so dividing it into a
   per-month figure would put a number on this chart that the goals board
   never shows and would contradict. Left out until a monthly target exists as
   real data. */

import { useEffect, useState } from "react";
import { LineChart as LineIcon, Table2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader } from "@/components/ui";
import { bahtShort, formatBaht, formatNum } from "@/lib/format";

export type TrendRow = { month: string; total: number; deal_count: number };

const THAI_MONTH = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** "2026-08" → "ส.ค.", with the Buddhist year appended in January so a
    12-month window crossing new year does not read as one flat stretch. */
function monthLabel(key: string): string {
  const m = Number(key.slice(5, 7));
  const label = THAI_MONTH[m - 1] ?? key;
  return m === 1
    ? `${label} ${String(Number(key.slice(0, 4)) + 543).slice(2)}`
    : label;
}

type Metric = "revenue" | "deals";

const METRICS: {
  id: Metric;
  label: string;
  money: boolean;
  hint: string;
}[] = [
  {
    id: "revenue",
    label: "รายได้",
    money: true,
    hint: "ค่าคอมมิชชันจากดีลที่ปิดได้ · รายเดือน · 12 เดือนล่าสุด",
  },
  {
    id: "deals",
    label: "จำนวนดีล",
    money: false,
    hint: "จำนวนดีลที่ปิดได้ · รายเดือน · 12 เดือนล่าสุด",
  },
];

export function RevenueTrendCard({ rows }: { rows: TrendRow[] }) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [asTable, setAsTable] = useState(false);
  const m = METRICS.find((x) => x.id === metric)!;

  const data = rows.map((r) => ({
    label: monthLabel(r.month),
    month: r.month,
    value: metric === "revenue" ? r.total : r.deal_count,
  }));

  const fmt = m.money ? formatBaht : (v: number) => formatNum(v);
  const fmtAxis = m.money ? bahtShort : (v: number) => formatNum(v);

  // Only the peak is direct-labelled. A number on every point is chaos and
  // goes unread; the axis and the tooltip carry the rest.
  const peak = data.reduce(
    (best, d) => (d.value > best.value ? d : best),
    data[0] ?? { value: 0, month: "", label: "" }
  );

  const sum = data.reduce((n, d) => n + d.value, 0);

  const still = usePrefersReducedMotion();

  return (
    <Card>
      <CardHeader
        title="แนวโน้มรายได้"
        action={
          <div className="flex items-center gap-1 rounded-full bg-surface-3 p-0.5">
            {METRICS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setMetric(x.id)}
                aria-pressed={x.id === metric}
                className={`rounded-full px-2.5 py-1 text-[0.72rem] font-medium transition-colors ${
                  x.id === metric
                    ? "bg-surface text-ink shadow-card"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                {x.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAsTable((t) => !t)}
              aria-pressed={asTable}
              aria-label={asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
              title={asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
              className={`grid size-6 place-items-center rounded-full transition-colors ${
                asTable
                  ? "bg-surface text-ink shadow-card"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              {asTable ? <LineIcon size={13} /> : <Table2 size={13} />}
            </button>
          </div>
        }
      />

      {/* The 12-month total is Habihub's own, not Klaichan's — her card leads
          with the hint alone. Kept because it is the figure that was already
          being read off this card every day, and swapping the chart underneath
          is no reason to take it away. */}
      <div className="px-5 pb-1">
        <div className="flex items-baseline gap-2">
          <span className="num text-xl font-semibold">
            {m.money ? formatBaht(sum) : formatNum(sum)}
          </span>
          <span className="text-xs text-ink-3">
            {m.money ? "คอมมิชชันรวม" : "ดีลรวม"} 12 เดือนล่าสุด
          </span>
        </div>
      </div>

      <p className="px-5 pb-3 text-[0.72rem] text-ink-3">
        {m.hint} · ไม่ขึ้นกับตัวกรองช่วงเวลา
      </p>

      <div className="px-5 pb-5">
        {asTable ? (
          <TrendTable rows={rows} metric={metric} money={m.money} />
        ) : (
          // Height includes the x-axis band, so the card never grows a nested
          // scrollbar that crops the month labels.
          <ResponsiveContainer width="100%" height={224}>
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="hh-rev-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--ink-3)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--ink-3)" }}
                axisLine={false}
                tickLine={false}
                width={m.money ? 56 : 32}
                tickFormatter={fmtAxis}
              />
              <Tooltip
                cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  fontSize: 12,
                  boxShadow: "var(--shadow-card)",
                }}
                labelStyle={{ color: "var(--ink-2)" }}
                formatter={(v) => [fmt(Number(v)), m.label] as [string, string]}
              />
              {/* `monotone`, not `natural` or `basis`, and the distinction is
                  load-bearing rather than cosmetic:

                    basis    does not pass through the data points at all — the
                             curve would sit near the peak month, not on it. A
                             chart that misses its own numbers is wrong.
                    natural  passes through them but may overshoot between
                             them, so a jump from ฿0 can dip BELOW the axis on
                             the way up. Negative commission.
                    monotone (Fritsch–Carlson) passes through every point and
                             is shape-preserving: it cannot overshoot, so a ฿0
                             month stays pinned at zero and the peak is the
                             peak.

                  Curvature here is smoothing between real monthly readings,
                  not a claim about the days in between. */}
              <Area
                type="monotone"
                dataKey="value"
                name={m.label}
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#hh-rev-fill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                // Recharts animates in JS, so a prefers-reduced-motion rule in
                // CSS cannot reach it — it has to be asked directly. 600ms
                // rather than the 1500ms default: this is a dashboard someone
                // glances at, not an entrance.
                isAnimationActive={!still}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {!asTable && peak.value > 0 && (
          <p className="pt-2 text-[0.72rem] text-ink-3">
            เดือนที่ดีที่สุด{" "}
            <span className="num font-semibold text-ink">
              {monthLabel(peak.month)}
            </span>{" "}
            · {fmt(peak.value)}
          </p>
        )}
      </div>
    </Card>
  );
}

/** Recharts drives its entry animation from JS, which a CSS
    `prefers-reduced-motion` block cannot touch. Read once on mount and follow
    changes, so switching the OS setting does not need a reload. Starts false
    so the server render and the first client render agree. */
function usePrefersReducedMotion(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const on = () => setStill(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return still;
}

/** The table-view twin. Empty months show "—" rather than 0, so a quiet month
    reads as quiet instead of as a recorded zero. */
function TrendTable({
  rows,
  metric,
  money,
}: {
  rows: TrendRow[];
  metric: Metric;
  money: boolean;
}) {
  return (
    <div className="max-h-[224px] overflow-y-auto">
      <table className="w-full text-[0.8rem]">
        <thead className="sticky top-0 bg-surface">
          <tr className="text-left text-[0.7rem] tracking-wide text-ink-3 uppercase">
            <th className="pb-1.5 font-medium">เดือน</th>
            <th className="pb-1.5 text-right font-medium">
              {money ? "รายได้" : "ดีล"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const v = metric === "revenue" ? r.total : r.deal_count;
            return (
              <tr key={r.month}>
                <td className="py-1.5 text-ink-2">{monthLabel(r.month)}</td>
                <td className="num py-1.5 text-right font-medium">
                  {v === 0 ? (
                    <span className="text-ink-3">—</span>
                  ) : money ? (
                    formatBaht(v)
                  ) : (
                    formatNum(v)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
