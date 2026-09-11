import { Card, Skeleton, TableSkeleton } from "@/components/ui";

/* The dashboard, and the group-wide fallback for any route without a
   loading.tsx of its own.
 *
 * REBUILT TO MATCH WHAT THE PAGE ACTUALLY OPENS WITH. It used to draw a
 * four-stat row, a donut and two tables — a layout this page last had before
 * the hero and the month-range picker arrived. The stat row in particular was
 * the worst of it: the real dashboard has no stats at the top at all, so the
 * whole page shifted down the moment the data landed.
 *
 * The dashboard varies by seat — ภาพรวมทีม and ของฉัน draw different cards —
 * so this matches the SHARED spine every version has: header with tabs, the
 * month-range strip, one tall hero, then a 3/2 split. Below that the versions
 * diverge and a skeleton would be guessing, so it stops.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* title + the ภาพรวม / ดีลปิด tab strip that sits in the header action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-1.5 h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>

      {/* month range picker — its own bordered strip */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        {["w-20", "w-24", "w-20", "w-20", "w-16"].map((w, i) => (
          <Skeleton key={i} className={`h-7 rounded-full ${w}`} />
        ))}
      </div>

      {/* revenue hero — the tallest thing above the fold */}
      <Card className="p-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-9 w-48" />
        <Skeleton className="mt-4 h-2 w-full rounded-full" />
        <div className="flex flex-wrap gap-4 pt-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      </Card>

      {/* trend (3 cols) beside the leaderboard / KPI card (2 cols) */}
      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="p-5 xl:col-span-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-4 h-40 w-full" />
        </Card>
        <Card className="xl:col-span-2">
          <div className="px-5 pt-4 pb-1">
            <Skeleton className="h-4 w-32" />
          </div>
          <TableSkeleton cols={3} rows={5} />
        </Card>
      </div>
    </div>
  );
}
