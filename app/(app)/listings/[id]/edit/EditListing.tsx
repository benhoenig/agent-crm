// The edit form's queries and markup, in one place, because TWO routes render
// it (Ben, 2026-09-11: "change our lead/listing details page into drawer …
// easy for sales to use"):
//
//   · app/(app)/@modal/(.)listings/[id]/edit — a click on แก้ไขข้อมูลทรัพย์
//     inside the drawer, which opens the form OVER the drawer instead of
//     navigating away from it. Klaichan's EditListingModal, as a route.
//   · ./page.tsx — the hard-load fallback: a refresh, a pasted link, a new
//     tab. Still the full page it always was.
//
// Same shape as loadListingDrawer next door, and for the same reason: the
// caller needs the frame's title separately from the body, and splitting that
// into two exported functions would run getListing() twice per open.
//
// `cancel` is the caller's, because dismissing means different things in the
// two frames — router.back() in the modal, a link in the page.

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getViewer } from "@/lib/auth/session";
import {
  getAgentOptions,
  getListing,
  getProjectOptions,
  getStationOptions,
  getZoneOptions,
} from "@/lib/repo/listings";
import { updateListing } from "../../actions";
import { ListingForm } from "../../ListingForm";

export const EDIT_LISTING_SUB =
  "ทุกการแก้ไขถูกบันทึกลงประวัติ (Listing Updates) อัตโนมัติ";

export async function loadListingEditor(
  id: string,
  cancel: ReactNode
): Promise<{ title: string; form: ReactNode }> {
  const viewer = await getViewer();
  const [detail, zones, agents, projects, stations] = await Promise.all([
    getListing(viewer, id),
    getZoneOptions(),
    getAgentOptions(),
    getProjectOptions(),
    getStationOptions(),
  ]);
  if (!detail) notFound();

  return {
    title: `แก้ไข: ${detail.listing.listingName ?? detail.listing.legacyCode ?? "ทรัพย์"}`,
    form: (
      <ListingForm
        action={updateListing.bind(null, id)}
        viewer={viewer}
        options={{ zones, agents, projects, stations }}
        defaults={detail.listing}
        ownerDefaults={
          detail.ownerVisible && detail.owner
            ? {
                name: detail.owner.name,
                phone: detail.owner.phone,
                lineId: detail.owner.lineId,
              }
            : null
        }
        cancel={cancel}
        submitLabel="บันทึกการแก้ไข"
      />
    ),
  };
}
