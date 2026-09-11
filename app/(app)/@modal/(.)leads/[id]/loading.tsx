// The drawer frame slides in on the click; the record streams into it. Without
// this the slot stays empty for five queries and the row reads as dead.
import { Card, Skeleton } from "@/components/ui";
import { RouteDrawer } from "@/components/ui/RouteDrawer";

export default function Loading() {
  return (
    <RouteDrawer title="กำลังโหลด…">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="space-y-2 p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
        </Card>
      ))}
    </RouteDrawer>
  );
}
