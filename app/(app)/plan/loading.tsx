import { Card, PageHeaderSkeleton, StatRowSkeleton, TableSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeaderSkeleton action={false} />
      {/* the page's own grid, so the boxes break at the same width it does */}
      <StatRowSkeleton count={4} className="grid grid-cols-2 gap-3 sm:grid-cols-4" />
      <Card>
        <TableSkeleton cols={2} rows={8} />
      </Card>
    </div>
  );
}
