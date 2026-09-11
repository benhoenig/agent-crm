import { FormPageSkeleton } from "@/components/ui";
import { RouteModal } from "@/components/ui/RouteModal";
import { NEW_LEAD_SUB, NEW_LEAD_TITLE } from "@/app/(app)/leads/new/NewLead";

export default function Loading() {
  return (
    <RouteModal title={NEW_LEAD_TITLE} sub={NEW_LEAD_SUB}>
      <FormPageSkeleton sections={3} header={false} />
    </RouteModal>
  );
}
