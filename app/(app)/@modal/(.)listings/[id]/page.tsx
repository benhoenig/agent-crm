// Intercepts a click on a grid row and puts the listing in a drawer over
// whatever list you were reading — /listings, /inventory, a search result.
// The list underneath is never re-rendered, so its scroll position, its sort
// and its column layout all survive.
//
// A hard load falls through to ../../listings/[id], which renders the list
// itself and then this same drawer over it.

import { RouteDrawer } from "@/components/ui/RouteDrawer";
import { loadListingDrawer } from "@/app/(app)/listings/[id]/ListingRecord";

export const dynamic = "force-dynamic";

export default async function ListingDrawer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { title, sub, badges, content } = await loadListingDrawer(id);
  return (
    <RouteDrawer title={title} sub={sub} badges={badges}>
      {content}
    </RouteDrawer>
  );
}
