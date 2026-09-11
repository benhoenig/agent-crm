import { Card, PageHeaderSkeleton, Skeleton, TableSkeleton } from "@/components/ui";

/* max-w-5xl, not 6xl — this page is narrower than the rest. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeaderSkeleton action={false} />
      {[
        { cols: 6, rows: 10 },
        { cols: 3, rows: 6 },
      ].map((t, i) => (
        <Card key={i}>
          <div className="px-5 pt-4 pb-1">
            <Skeleton className="h-4 w-36" />
          </div>
          <TableSkeleton cols={t.cols} rows={t.rows} />
        </Card>
      ))}
    </div>
  );
}
