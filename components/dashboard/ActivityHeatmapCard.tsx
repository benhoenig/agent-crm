"use client";

/* กิจกรรมรายวัน × เอเจนต์ — one calendar month, day by day.

   Ported from the Habihub Sales Dashboard's ActivityHeatmap (Ben,
   2026-08-28). The matrix below it says HOW MUCH each person did; this says
   WHEN, and they are different management questions. A row of zeroes across
   every agent is a day the whole team lost; a column that goes pale after the
   10th is one person going quiet, which no monthly total would ever show.

   SHOWS THE END MONTH OF THE RANGE. A heatmap of a six-month span has no rows
   to be, and the last month is the one being asked about — the source makes
   the same call and says so.

   AGENTS ARE ORDERED BY VOLUME, busiest first, so the grid reads as a ranking
   down the columns as well as a calendar down the rows.

   The category filter is client-side over cells the server already sent (a
   few hundred rows — see getActivityHeatmap): a round trip per toggle would
   put a spinner on a control people flip while thinking. */

import { useMemo, useState } from "react";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { daysInMonth, monthLabel } from "@/lib/month-range";
import type { HeatCell, TeamMember } from "@/lib/repo/team-overview";
import { heatStyle } from "./heat";

const FILTERS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "owner", label: "ฝั่งเจ้าของ" },
  { id: "buyer", label: "ฝั่งผู้ซื้อ" },
  { id: "other", label: "อื่นๆ" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

export function ActivityHeatmapCard({
  cells,
  team,
  monthKey,
  today,
}: {
  cells: HeatCell[];
  team: TeamMember[];
  monthKey: string;
  /** Asia/Bangkok today, for the "you are here" row marker. */
  today: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const days = daysInMonth(monthKey);
  const isCurrentMonth = today.slice(0, 7) === monthKey;
  const todayDay = Number(today.slice(8, 10));

  const { agents, totals, grid, max } = useMemo(() => {
    const g = new Map<string, number>();
    const t = new Map<string, number>();
    for (const c of cells) {
      if (filter !== "all" && c.scope !== filter) continue;
      const key = `${c.day}:${c.agentId}`;
      g.set(key, (g.get(key) ?? 0) + c.n);
      t.set(c.agentId, (t.get(c.agentId) ?? 0) + c.n);
    }
    const ordered = [...team].sort(
      (a, b) => (t.get(b.id) ?? 0) - (t.get(a.id) ?? 0)
    );
    return {
      agents: ordered,
      totals: ordered.map((m) => t.get(m.id) ?? 0),
      grid: g,
      max: Math.max(1, ...g.values()),
    };
  }, [cells, team, filter]);

  const cols = `2rem repeat(${agents.length}, minmax(2.75rem, 1fr))`;

  return (
    <Card>
      <CardHeader
        title="กิจกรรมรายวัน × เอเจนต์"
        action={
          <span className="text-[0.7rem] tracking-wide text-ink-3">
            {monthLabel(monthKey)}
          </span>
        }
      />
      <div className="flex flex-wrap gap-1 px-5 pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={f.id === filter}
            className={`rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition-colors ${
              f.id === filter
                ? "bg-accent-soft text-accent-text"
                : "bg-surface-3 text-ink-3 hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {agents.length === 0 ? (
        <EmptyState title="ยังไม่มีเซลส์ในระบบ" />
      ) : (
        <div className="overflow-x-auto px-5 pb-5">
          <div style={{ minWidth: `${2 + agents.length * 3.5}rem` }}>
            <div
              className="grid gap-1 pb-2"
              style={{ gridTemplateColumns: cols }}
            >
              <div />
              {agents.map((a, i) => (
                <div key={a.id} className="flex flex-col items-center gap-1">
                  <Avatar
                    image={a.image}
                    name={a.name}
                    size="size-7 text-[0.68rem]"
                  />
                  <span className="max-w-full truncate text-[0.62rem] text-ink-3">
                    {a.name}
                  </span>
                  <span
                    className={`num text-[0.62rem] ${
                      i === 0 && totals[i]! > 0
                        ? "font-semibold text-ink"
                        : "text-ink-3"
                    }`}
                  >
                    {totals[i]}
                  </span>
                </div>
              ))}
            </div>

            {Array.from({ length: days }, (_, d) => d + 1).map((day) => {
              const isToday = isCurrentMonth && day === todayDay;
              return (
                <div
                  key={day}
                  className="grid gap-1 pb-1"
                  style={{ gridTemplateColumns: cols }}
                >
                  <div
                    className={`num self-center pr-1.5 text-right text-[0.62rem] ${
                      isToday ? "font-semibold text-accent-text" : "text-ink-3"
                    }`}
                  >
                    {day}
                  </div>
                  {agents.map((a) => {
                    const v = grid.get(`${day}:${a.id}`) ?? 0;
                    return (
                      <div
                        key={a.id}
                        className={`num grid h-6 place-items-center rounded text-[0.66rem] ${
                          isToday ? "ring-1 ring-accent/40" : ""
                        }`}
                        style={heatStyle(v, max)}
                        title={`${a.name} · ${day} — ${v}`}
                      >
                        {v || ""}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div className="flex items-center gap-1.5 pt-3 text-[0.62rem] text-ink-3">
              <span>น้อย</span>
              {[0.15, 0.35, 0.55, 0.75, 1].map((p) => (
                <span
                  key={p}
                  className="size-3.5 rounded"
                  style={heatStyle(p, 1)}
                />
              ))}
              <span>มาก</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
