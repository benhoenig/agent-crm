import { Card, TableSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <Card>
      <TableSkeleton cols={6} rows={6} />
    </Card>
  );
}
