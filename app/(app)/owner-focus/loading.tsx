import { Card, PageHeaderSkeleton, Skeleton } from "@/components/ui";

/* Not a table — a stack of per-owner Cards, each a header strip over its
   listings. Full width: this page has no mx-auto max-w wrapper of its own. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton action={false} />
      <div className="space-y-4">
        {[3, 2, 4].map((rows, g) => (
          <Card key={g} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-3 border-b border-line bg-surface-2 px-5 py-2.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="divide-y divide-line">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="size-10 shrink-0 rounded-ctl" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="mt-1.5 h-3 w-36" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
