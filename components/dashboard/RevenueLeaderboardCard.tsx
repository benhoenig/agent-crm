/* รายได้ตามเอเจนต์ — who closed what, over the selected range.

   Ported from the Habihub Sales Dashboard's RevenueLeaderboard (Ben,
   2026-08-28). It replaces the flat name+figure list that stood here, and the
   difference that matters is the BAR: a column of baht amounts makes the
   reader do the division, while a bar scaled to the leader shows the spread
   at a glance — which is the actual question a leaderboard is asked.

   TEAM-WIDE, not viewer-scoped, exactly as the list it replaces was: an
   aggregate with no PII, and a leaderboard filtered to your own row is not
   one (lib/repo/team-overview.ts says the same).

   FOLLOWS THE ช่วงเวลา PICKER, unlike the old card's hardcoded "this year".
   A year-to-date ranking in August is a ranking of who started strong. */

import Link from "next/link";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { formatBaht, formatNum } from "@/lib/format";
import type { LeaderRow } from "@/lib/repo/team-overview";

export function RevenueLeaderboardCard({
  rows,
  label,
}: {
  rows: LeaderRow[];
  /** The range in words — the card must say what it is counting. */
  label: string;
}) {
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <Card>
      <CardHeader
        title="รายได้ตามเอเจนต์"
        action={
          <Link
            href="/?tab=deals"
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            ดีลทั้งหมด →
          </Link>
        }
      />
      <p className="px-5 pb-3 text-[0.72rem] text-ink-3">
        เรียงตามค่าคอมมิชชันจากดีลที่ปิดได้ · {label}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="ยังไม่มีดีลปิดในช่วงนี้"
          hint="ลองขยายช่วงเวลาด้านบน"
        />
      ) : (
        <ul className="space-y-2.5 px-5 pb-5">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2.5">
              <span className="num w-5 shrink-0 text-[0.7rem] text-ink-3">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Avatar
                image={r.image}
                name={r.name}
                size="size-7 text-[0.68rem]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 pb-1">
                  <span className="truncate text-xs font-medium">{r.name}</span>
                  <span className="num shrink-0 text-[0.68rem] text-ink-3">
                    {formatNum(r.deals)} ดีล
                  </span>
                </div>
                {/* Scaled to the leader, not to the target: this card ranks,
                    and the hero above is where progress against a goal is
                    read. rounded-full because the control radius squares off
                    the ends of a bar this thin. */}
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full ${
                      i === 0 ? "bg-chart-6" : "bg-accent"
                    }`}
                    style={{ width: `${(r.total / max) * 100}%` }}
                  />
                </div>
              </div>
              <span className="num w-24 shrink-0 text-right text-xs font-semibold">
                {formatBaht(r.total)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
