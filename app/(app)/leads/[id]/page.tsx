// NOT a detail page any more — see app/(app)/listings/[id]/page.tsx for the
// full reasoning. A lead is only ever seen in a drawer, so this route renders
// the LIST with that drawer open over it, and it is reached on a hard load
// only: a click from the grid is intercepted into app/(app)/@modal.

import { RouteDrawer } from "@/components/ui/RouteDrawer";
import { LeadsIndex } from "../LeadsIndex";
import { loadLeadDrawer } from "./LeadRecord";
import type { Search } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { title, sub, badges, content } = await loadLeadDrawer(id);
  return (
    <>
      <LeadsIndex sp={sp} />
      <RouteDrawer title={title} sub={sub} badges={badges}>
        {content}
      </RouteDrawer>
    </>
  );
}
