// The modal frame appears on the click; the form streams in behind it. No
// drawer skeleton underneath — see the listings twin.
import { FormPageSkeleton } from "@/components/ui";
import { RouteModal } from "@/components/ui/RouteModal";
import { EDIT_LEAD_SUB } from "@/app/(app)/leads/[id]/edit/EditLead";

export default function Loading() {
  return (
    <RouteModal title="กำลังโหลด…" sub={EDIT_LEAD_SUB}>
      <FormPageSkeleton sections={4} header={false} />
    </RouteModal>
  );
}
