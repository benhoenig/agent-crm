// The modal frame appears on the click; the form streams in behind it. Without
// this the slot is empty until five option queries return, and + เพิ่มทรัพย์
// reads as a dead button.
import { FormPageSkeleton } from "@/components/ui";
import { RouteModal } from "@/components/ui/RouteModal";
import { NEW_LISTING_SUB, NEW_LISTING_TITLE } from "@/app/(app)/listings/new/NewListing";

export default function Loading() {
  return (
    <RouteModal title={NEW_LISTING_TITLE} sub={NEW_LISTING_SUB}>
      <FormPageSkeleton sections={4} header={false} />
    </RouteModal>
  );
}
