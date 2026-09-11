// Intercepts + เพิ่ม Lead into an overlay. Twin of (.)listings/new — see that
// file for why (.) is the correct marker from inside a slot.

import { RouteModal, ModalCancelButton } from "@/components/ui/RouteModal";
import { param, type Search } from "@/lib/search-params";
import {
  NEW_LEAD_SUB,
  NEW_LEAD_TITLE,
  NewLead,
} from "@/app/(app)/leads/new/NewLead";

export const dynamic = "force-dynamic";

export default async function NewLeadModal({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const draftId = Number(param(sp, "draft")) || null;

  return (
    <RouteModal title={NEW_LEAD_TITLE} sub={NEW_LEAD_SUB}>
      <NewLead draftId={draftId} cancel={<ModalCancelButton />} />
    </RouteModal>
  );
}
