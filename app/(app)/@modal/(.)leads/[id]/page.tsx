// Intercepts a click on a lead row and puts the record in a drawer over
// whatever list you were reading — /leads, the pipeline board,
// /lead-directory. Twin of (.)listings/[id].

import { RouteDrawer } from "@/components/ui/RouteDrawer";
import { loadLeadDrawer } from "@/app/(app)/leads/[id]/LeadRecord";

export const dynamic = "force-dynamic";

export default async function LeadDrawer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { title, sub, badges, content } = await loadLeadDrawer(id);
  return (
    <RouteDrawer title={title} sub={sub} badges={badges}>
      {content}
    </RouteDrawer>
  );
}
