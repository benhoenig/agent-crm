// Intercepts a client-side click on + เพิ่มทรัพย์ and renders the same
// <NewListing> body inside an overlay, over whatever page you were on.
//
// (.) matches the SAME SEGMENT LEVEL, and it is the right marker even though
// this file is two folders deeper than app/(app)/listings/new: the convention
// counts route segments, and neither @modal (a slot) nor (app) (a group) is
// one. So this sits at "/" alongside `listings`, exactly like the page it
// intercepts.
//
// Only client-side navigation is intercepted. A refresh or a pasted link is a
// hard load, which falls through to the real page — which is the whole point.

import { RouteModal, ModalCancelButton } from "@/components/ui/RouteModal";
import { param, type Search } from "@/lib/search-params";
import {
  NEW_LISTING_SUB,
  NEW_LISTING_TITLE,
  NewListing,
} from "@/app/(app)/listings/new/NewListing";

export const dynamic = "force-dynamic";

export default async function NewListingModal({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const draftId = Number(param(sp, "draft")) || null;

  return (
    <RouteModal title={NEW_LISTING_TITLE} sub={NEW_LISTING_SUB}>
      <NewListing draftId={draftId} cancel={<ModalCancelButton />} />
    </RouteModal>
  );
}
