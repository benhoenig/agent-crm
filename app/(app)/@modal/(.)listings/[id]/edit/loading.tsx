// The modal frame appears on the click; the form streams in behind it.
//
// NO DRAWER SKELETON UNDERNEATH, unlike the page this is a loading state for.
// The drawer is already on screen when แก้ไข is clicked, and Next keeps the
// previous slot content painted until this replaces it — drawing a skeleton
// drawer here would blank a record the user is still reading, to show them a
// worse copy of it.
import { FormPageSkeleton } from "@/components/ui";
import { RouteModal } from "@/components/ui/RouteModal";
import { EDIT_LISTING_SUB } from "@/app/(app)/listings/[id]/edit/EditListing";

export default function Loading() {
  return (
    <RouteModal title="กำลังโหลด…" sub={EDIT_LISTING_SUB}>
      <FormPageSkeleton sections={4} header={false} />
    </RouteModal>
  );
}
