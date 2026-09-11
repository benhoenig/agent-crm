import { ListPageSkeleton } from "@/components/ui";

/* The Lead twin of /inventory: header, a six-field filter bar, then LeadsGrid.
   No "+ เพิ่ม" button — this page is read-only by design. */
export default function Loading() {
  return <ListPageSkeleton cols={10} action={false} />;
}
