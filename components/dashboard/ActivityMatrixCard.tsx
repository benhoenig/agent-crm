/* จำนวนแอคชั่นรายกิจกรรม — the shape of each person's month.

   Ported from the Habihub Sales Dashboard's ActivityMatrix (Ben, 2026-08-28).
   Where ผลงานตามกระบวนการขาย asks "is everyone hitting their acquisition
   target", this asks the flatter question that card cannot: a column with a
   number for everyone except one agent is the thing worth seeing, and it has
   no target to be measured against.

   SHADED PER COLUMN, not across the whole table — the source is explicit
   about this and it is the right call. Owner Talk runs an order of magnitude
   above Close; one global scale would wash every low-volume column out to
   empty and hide exactly the activities where a zero matters most.

   COLUMNS ARE GROUPED BY `options.scope`, so เจ้าของ / ผู้ซื้อ / อื่นๆ read as
   blocks. The scope-NULL block is included here although both funnels exclude
   it: they exclude it because guessing it into one would inflate a number
   someone is measured on, and here nothing is being measured, so leaving it
   out would only hide work. */

import { Card, CardHeader, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import type { ActivityMatrix, TeamMember } from "@/lib/repo/team-overview";
import { heatStyle } from "./heat";

const GROUP_LABEL: Record<string, string> = {
  owner: "ฝั่งเจ้าของ",
  buyer: "ฝั่งผู้ซื้อ",
  other: "อื่นๆ",
};

export function ActivityMatrixCard({
  matrix,
  team,
  label,
}: {
  matrix: ActivityMatrix;
  team: TeamMember[];
  label: string;
}) {
  const { categories, counts } = matrix;

  const rows = team.map((m) => {
    const cells = counts[m.id] ?? {};
    return {
      ...m,
      cells,
      // The row total counts EVERY action logged, including one filed under a
      // category archived since — the column is gone, the work was not.
      total: Object.values(cells).reduce((n, v) => n + v, 0),
    };
  });

  const colMax: Record<string, number> = {};
  const colTotal: Record<string, number> = {};
  for (const c of categories) {
    colMax[c.key] = Math.max(1, ...rows.map((r) => r.cells[c.key] ?? 0));
    colTotal[c.key] = rows.reduce((n, r) => n + (r.cells[c.key] ?? 0), 0);
  }
  const grand = rows.reduce((n, r) => n + r.total, 0);

  // Contiguous runs of one scope, for the grouped header row.
  const groups: { scope: string; span: number }[] = [];
  for (const c of categories) {
    const last = groups[groups.length - 1];
    if (last && last.scope === c.scope) last.span++;
    else groups.push({ scope: c.scope, span: 1 });
  }
  const divides = new Set(
    groups.slice(1).map((_, i) =>
      groups.slice(0, i + 1).reduce((n, g) => n + g.span, 0)
    )
  );

  return (
    <Card>
      <CardHeader title="จำนวนแอคชั่นรายกิจกรรม" />
      <p className="px-5 pb-3 text-[0.72rem] text-ink-3">
        จำนวนครั้งของแต่ละกิจกรรม รายคน · เข้มตามคอลัมน์ · {label}
      </p>

      {categories.length === 0 || team.length === 0 ? (
        <EmptyState title="ยังไม่มีข้อมูลกิจกรรม" />
      ) : (
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface-2" />
                {groups.map((g, i) => (
                  <th
                    key={g.scope}
                    colSpan={g.span}
                    className={`border-b border-line pb-1 text-[0.62rem] font-medium tracking-wide text-ink-3 uppercase ${
                      i > 0 ? "border-l" : ""
                    }`}
                  >
                    {GROUP_LABEL[g.scope] ?? g.scope}
                  </th>
                ))}
                <th className="border-b border-line" />
              </tr>
              <tr>
                <th className="sticky left-0 z-10 bg-surface-2" />
                {categories.map((c, i) => (
                  <th
                    key={c.key}
                    title={c.key}
                    className={`px-1.5 py-1.5 text-[0.66rem] font-medium whitespace-nowrap text-ink-3 ${
                      divides.has(i) ? "border-l border-line" : ""
                    }`}
                  >
                    {c.key}
                  </th>
                ))}
                <th className="px-1.5 py-1.5 text-[0.66rem] font-semibold text-ink">
                  รวม
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="sticky left-0 z-10 bg-surface-2 py-1 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        image={r.image}
                        name={r.name}
                        size="size-6 text-[0.6rem]"
                      />
                      <span className="text-xs whitespace-nowrap">
                        {r.name}
                      </span>
                    </div>
                  </td>
                  {categories.map((c, i) => {
                    const v = r.cells[c.key] ?? 0;
                    return (
                      <td
                        key={c.key}
                        className={`px-1 py-1 text-center ${
                          divides.has(i) ? "border-l border-line" : ""
                        }`}
                      >
                        <span
                          className="num inline-block min-w-7 rounded px-1 py-0.5 text-[0.7rem]"
                          style={heatStyle(v, colMax[c.key]!)}
                        >
                          {v || ""}
                        </span>
                      </td>
                    );
                  })}
                  <td className="num px-1.5 py-1 text-center text-[0.72rem] font-semibold">
                    {r.total}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-line-strong">
                <td className="sticky left-0 z-10 bg-surface-2 py-1.5 pr-3 text-[0.7rem] font-semibold text-ink-3">
                  ทั้งทีม
                </td>
                {categories.map((c, i) => (
                  <td
                    key={c.key}
                    className={`num px-1 py-1.5 text-center text-[0.7rem] text-ink-2 ${
                      divides.has(i) ? "border-l border-line" : ""
                    }`}
                  >
                    {colTotal[c.key]}
                  </td>
                ))}
                <td className="num px-1.5 py-1.5 text-center text-[0.72rem] font-bold">
                  {grand}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
