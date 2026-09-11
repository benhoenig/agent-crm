import { Card, TableSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <Card>
      <TableSkeleton cols={3} rows={8} />
    </Card>
  );
}
