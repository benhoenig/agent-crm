import { Card, PageHeaderSkeleton, Skeleton, TableSkeleton } from "@/components/ui";

const QUEUES = [
  { cols: 4, rows: 5 },
  { cols: 4, rows: 4 },
  { cols: 5, rows: 4 },
];

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeaderSkeleton action={false} />
      {QUEUES.map((q, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-5 w-10" />
          </div>
          <TableSkeleton cols={q.cols} rows={q.rows} />
        </Card>
      ))}
    </div>
  );
}
