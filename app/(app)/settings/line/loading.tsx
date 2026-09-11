import { Card, Skeleton, TableSkeleton } from "@/components/ui";

/* Two Cards: the three-field "add a group" form, then the group table. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <Card>
        <div className="px-5 pt-4 pb-1">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-1.5 h-[38px]" />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="px-5 pt-4 pb-1">
          <Skeleton className="h-4 w-32" />
        </div>
        <TableSkeleton cols={4} rows={5} />
      </Card>
    </div>
  );
}
