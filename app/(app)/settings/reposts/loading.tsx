import { Card, TableSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <Card>
      <TableSkeleton cols={5} rows={5} />
    </Card>
  );
}
