import { Card, Skeleton } from "@/components/ui";

/* This page opens with a 16:7 cover photo, not a title — so DetailPageSkeleton,
   which draws a title block and a two-column fact grid, promised a layout this
   route stopped having when the gallery landed. The hero is also the tallest
   thing here, so getting it wrong moved everything below it. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* the cover — same aspect box ProjectCover reserves */}
      <Skeleton className="aspect-[16/7] w-full rounded-card" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* the five-fact strip — the page's own grid and gaps */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-1.5 h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>

      {/* จุดเด่นโครงการ — a paragraph */}
      <Card>
        <div className="px-5 pt-4 pb-1">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-1.5 px-5 pb-5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      </Card>

      {/* สิ่งอำนวยความสะดวกส่วนกลาง — Pill chips */}
      <Card>
        <div className="px-5 pt-4 pb-1">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex flex-wrap gap-1.5 px-5 pb-5">
          {["w-16", "w-24", "w-14", "w-20", "w-28", "w-16"].map((w, i) => (
            <Skeleton key={i} className={`h-6 rounded-full ${w}`} />
          ))}
        </div>
      </Card>
    </div>
  );
}
