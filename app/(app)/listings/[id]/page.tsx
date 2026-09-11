// NOT a detail page any more (Ben, 2026-08-29: "make the whole page as a
// drawer like Klaichan instead"). A listing is only ever seen in a drawer, so
// this route renders the LIST with that drawer open over it.
//
// It is reached on a HARD load only — a refresh, a pasted link, a new tab.
// A click from the grid is intercepted into app/(app)/@modal, which puts the
// same drawer over the list already on screen without re-rendering it.
//
// The list behind it comes up unfiltered, which is the honest answer: the URL
// carries the record, not the search that found it.

import { RouteDrawer } from "@/components/ui/RouteDrawer";
import { ListingsIndex } from "../ListingsIndex";
import { loadListingDrawer } from "./ListingRecord";
import type { Search } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { title, sub, badges, content } = await loadListingDrawer(id);
  return (
    <>
      <ListingsIndex sp={sp} />
      <RouteDrawer title={title} sub={sub} badges={badges}>
        {content}
      </RouteDrawer>
    </>
  );
}
