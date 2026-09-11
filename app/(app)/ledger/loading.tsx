import { Card, PageHeaderSkeleton, Skeleton, StatRowSkeleton } from "@/components/ui";

/* Matches /ledger's DEFAULT view, which since the multi-account rebuild is
   ภาพรวม — not the transaction table. The old skeleton still drew a six-column
   table straight under the stats, so the page it promised was the one you got
   only if you clicked through to สมุดบัญชี; on the landing view every row of it
   was wrong and the whole page jumped when the data arrived.

   Kept deliberately short of the monthly-flow table at the bottom: a skeleton
   that runs past the fold costs a screenful of grey to save nothing. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeaderSkeleton />
      <StatRowSkeleton count={4} />

      {/* view tabs + year/month pills */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* ภาพรวม · สมุดบัญชี · งบกำไรขาดทุน (P&L) · บัญชีธนาคาร */}
          {["w-16", "w-20", "w-36", "w-28"].map((w, i) => (
            <Skeleton key={`tab-${i}`} className={`h-7 rounded-full ${w}`} />
          ))}
          <div className="mx-2 h-5 w-px bg-line" />
          {[0, 1].map((i) => (
            <Skeleton key={`yr-${i}`} className="h-7 w-14 rounded-full" />
          ))}
        </div>
      </Card>

      {/* the account cards — the thing this page now opens on */}
      <Card>
        <div className="px-5 pt-4 pb-1">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="rounded-card border border-line bg-surface-2 p-4"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-1.5 h-3 w-36" />
              <Skeleton className="mt-3 h-6 w-32" />
              <Skeleton className="mt-1.5 h-3 w-44" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
