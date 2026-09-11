import { Card, PageHeaderSkeleton, StatRowSkeleton, Skeleton, TableSkeleton } from "@/components/ui";

/* Three stacked tables — ต้องแก้ก่อนตรวจ, รอตรวจ, ตรวจแล้ว — under a four-stat
   row. The middle one is the long one, so it carries the rows. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeaderSkeleton />
      <StatRowSkeleton count={4} />
      {[
        { cols: 5, rows: 3 },
        { cols: 8, rows: 8 },
        { cols: 5, rows: 3 },
      ].map((t, i) => (
        <Card key={i}>
          <div className="px-5 pt-4 pb-1">
            <Skeleton className="h-4 w-40" />
          </div>
          <TableSkeleton cols={t.cols} rows={t.rows} />
        </Card>
      ))}
    </div>
  );
}
