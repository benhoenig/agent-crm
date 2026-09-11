import { Card, TableSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <Card>
      <TableSkeleton cols={2} rows={8} />
    </Card>
  );
}
