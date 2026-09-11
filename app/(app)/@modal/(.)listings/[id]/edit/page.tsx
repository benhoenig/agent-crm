// แก้ไขข้อมูลทรัพย์, opened OVER the drawer instead of navigating away from it
// (Ben, 2026-09-11). Klaichan's EditListingModal, which is a useState modal
// inside its sheet — here it is a route, so it keeps the three things
// RouteModal's comment lists: the form stays a server component, /edit still
// works as a page, and Back closes it.
//
// WHY IT RENDERS THE DRAWER TOO. @modal is ONE slot. At /listings/<id> it
// holds the drawer; at /listings/<id>/edit it holds this file, and whatever a
// slot renders replaces what it rendered before. Without the drawer below,
// clicking แก้ไข would make the record slide away and leave the form floating
// over the bare list — the page-navigation feel this was meant to end.
//
// So the cost is honest: opening the editor re-runs loadListingDrawer. Both
// halves are force-dynamic and the drawer is what you were just looking at,
// so it is one extra round of queries per edit-open, spent to keep the record
// on screen while you change it.
//
// A hard load is not intercepted and falls through to the real
// listings/[id]/edit page — the full-page form, with no drawer behind it.

import { RouteDrawer } from "@/components/ui/RouteDrawer";
import { RouteModal, ModalCancelButton } from "@/components/ui/RouteModal";
import { loadListingDrawer } from "@/app/(app)/listings/[id]/ListingRecord";
import {
  EDIT_LISTING_SUB,
  loadListingEditor,
} from "@/app/(app)/listings/[id]/edit/EditListing";

export const dynamic = "force-dynamic";

export default async function EditListingModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [record, editor] = await Promise.all([
    loadListingDrawer(id),
    loadListingEditor(id, <ModalCancelButton />),
  ]);

  return (
    <>
      <RouteDrawer title={record.title} sub={record.sub} badges={record.badges}>
        {record.content}
      </RouteDrawer>
      <RouteModal title={editor.title} sub={EDIT_LISTING_SUB}>
        {editor.form}
      </RouteModal>
    </>
  );
}
