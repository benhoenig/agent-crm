import { Card, Skeleton, TableSkeleton } from "@/components/ui";

/* One Card: header, the explanatory paragraph, then the manager's table.
   The settings shell (tabs + page title) is drawn by the layout above and is
   already on screen, so this skeleton starts at the Card. */
export default function Loading() {
  return (
    <Card>
      <div className="px-5 pt-4 pb-1">
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-1.5 px-5 pb-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <TableSkeleton cols={3} rows={6} />
    </Card>
  );
}
