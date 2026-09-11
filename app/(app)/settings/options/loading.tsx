import { Card, TableSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <Card>
      <TableSkeleton cols={4} rows={10} />
    </Card>
  );
}
