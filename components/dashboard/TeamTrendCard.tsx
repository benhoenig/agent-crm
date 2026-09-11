"use client";

/* แนวโน้มรายปี — any one metric across the twelve months of this year.

   Ported from the Habihub Sales Dashboard's Overview trend card + its
   MetricSelector (Ben, 2026-08-28). One card that can be pointed at revenue,
   leads, listings or any logged activity replaces a wall of small charts
   nobody has room for, and the pill row makes switching cost a click rather
   than a scroll.

   DELIBERATELY NOT DRIVEN BY THE ช่วงเวลา PICKER, exactly as in the source. A
   trend needs a span longer than the thing being filtered: "เดือนนี้" would
   collapse this to a single point, and a one-point line chart is a stat tile
   with extra chrome. The subtitle says so rather than leaving the reader to
   discover it.

   Every series is fetched with the page and the toggle is client-side (see
   lib/repo/team-overview.ts getTeamTrend) — a round trip per pill press is a
   spinner on every glance. */

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, Select } from "@/components/ui";
import { bahtShort, formatBaht, formatNum } from "@/lib/format";
import { monthTick } from "@/lib/month-range";
import type { TeamMetric } from "@/lib/team-metrics";
import type { TeamTrend } from "@/lib/repo/team-overview";

/* Which metric you were last looking at is a reading preference, not a page
   parameter — it changes nothing on the server, so unlike the month range it
   stays in the browser. Wrapped because localStorage throws outright in
   private windows and with site data blocked. */
const PREF_KEY = "hh.dashboard.trend";

function readPref(): string | null {
  try {
    return window.localStorage.getItem(PREF_KEY);
  } catch {
    return null;
  }
}
function writePref(v: string) {
  try {
    window.localStorage.setItem(PREF_KEY, v);
  } catch {
    /* ignore */
  }
}

export function TeamTrendCard({
  trend,
  metrics,
  monthlyTarget,
}: {
  trend: TeamTrend;
  /** Built on the server: the core metrics plus one per action category,
      minus anything the viewer's deal scope does not permit. */
  metrics: TeamMetric[];
  /** The team's monthly revenue target — a dashed line on the revenue series
      only, and omitted entirely when nobody has set one. */
  monthlyTarget: number | null;
}) {
  const [key, setKey] = useState(metrics[0]?.key ?? "revenue");

  // Read after mount so the server render and the first client render agree;
  // a mismatch here would hydrate-error the dashboard.
  useEffect(() => {
    const saved = readPref();
    if (saved && metrics.some((m) => m.key === saved)) setKey(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(next: string) {
    setKey(next);
    writePref(next);
  }

  const metric = metrics.find((m) => m.key === key) ?? metrics[0];
  const money = metric?.fmt === "baht";
  const values = trend.series[metric?.key ?? ""] ?? [];

  const data = trend.months.map((month, i) => ({
    label: monthTick(month),
    month,
    value: values[i] ?? 0,
  }));

  const fmt = money ? formatBaht : (v: number) => formatNum(v);
  const fmtAxis = money ? bahtShort : (v: number) => formatNum(v);

  const total = data.reduce((n, d) => n + d.value, 0);
  const peak = data.reduce(
    (best, d) => (d.value > best.value ? d : best),
    data[0] ?? { value: 0, month: "", label: "" }
  );

  const primary = metrics.filter((m) => m.primary);
  const others = metrics.filter((m) => !m.primary);
  const inOthers = others.some((m) => m.key === key);

  const target = metric?.key === "revenue" ? monthlyTarget : null;
  const still = usePrefersReducedMotion();

  return (
    <Card>
      <CardHeader
        title="แนวโน้มรายปี"
        action={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <div className="flex items-center gap-1 rounded-full bg-surface-3 p-0.5">
              {primary.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => pick(m.key)}
                  aria-pressed={m.key === key}
                  className={`rounded-full px-2.5 py-1 text-[0.72rem] font-medium transition-colors ${
                    m.key === key
                      ? "bg-surface text-ink shadow-card"
                      : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {others.length > 0 && (
              <Select
                value={inOthers ? key : ""}
                onChange={(e) => e.target.value && pick(e.target.value)}
                aria-label="เลือกตัวชี้วัดอื่น"
                className={`w-auto rounded-full px-2 py-1 text-[0.72rem] ${
                  inOthers ? "border-accent text-ink" : "text-ink-3"
                }`}
              >
                <option value="">อื่นๆ…</option>
                {others.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </div>
        }
      />

      <div className="px-5 pb-1">
        <div className="flex items-baseline gap-2">
          <span className="num text-xl font-semibold">{fmt(total)}</span>
          <span className="text-xs text-ink-3">
            {metric?.label} รวมทั้งปี {Number(trend.months[0]?.slice(0, 4)) + 543}
          </span>
        </div>
      </div>

      <p className="px-5 pb-3 text-[0.72rem] text-ink-3">
        ทั้งทีม · รายเดือน · ไม่ขึ้นกับตัวกรองช่วงเวลา
        {target ? ` · เส้นประคือเป้าทีมต่อเดือน ${formatBaht(target)}` : ""}
      </p>

      <div className="px-5 pb-5">
        <ResponsiveContainer width="100%" height={224}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="hh-team-trend" x1="0" y1="0" x2="0" y2="1">
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
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--ink-3)" }}
              axisLine={false}
              tickLine={false}
              width={money ? 56 : 32}
              tickFormatter={fmtAxis}
              allowDecimals={false}
              /* The target must stay inside the plot even in a month that
                 missed it badly, or the dashed line silently vanishes and the
                 chart looks like it has no target at all. */
              domain={[0, (max: number) => Math.max(max, target ?? 0) * 1.1]}
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
              formatter={(v) =>
                [fmt(Number(v)), metric?.label ?? ""] as [string, string]
              }
            />
            {target ? (
              <ReferenceLine
                y={target}
                stroke="var(--ink-3)"
                strokeDasharray="4 4"
                label={{
                  value: "เป้า",
                  position: "right",
                  fill: "var(--ink-3)",
                  fontSize: 10,
                }}
              />
            ) : null}
            {/* `monotone` (Fritsch–Carlson): passes through every point and
                cannot overshoot, so a zero month stays pinned at zero instead
                of dipping below the axis on the way up. See
                RevenueTrendCard for the full comparison. */}
            <Area
              type="monotone"
              dataKey="value"
              name={metric?.label}
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#hh-team-trend)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              isAnimationActive={!still}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>

        {peak.value > 0 && (
          <p className="pt-2 text-[0.72rem] text-ink-3">
            เดือนที่ดีที่สุด{" "}
            <span className="num font-semibold text-ink">
              {monthTick(peak.month)}
            </span>{" "}
            · {fmt(peak.value)}
          </p>
        )}
      </div>
    </Card>
  );
}

/** Recharts animates in JS, which a CSS prefers-reduced-motion block cannot
    reach — it has to be asked directly. Starts false so the server render and
    the first client render agree. */
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
