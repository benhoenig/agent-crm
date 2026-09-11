// The full page. Reached by refresh, a pasted link, or the AI tray from a
// cold load — a client-side click on + เพิ่ม Lead is intercepted into a modal
// instead (app/(app)/@modal/(.)leads/new). Both render <NewLead>.

import { LinkButton, PageHeader } from "@/components/ui";
import { param, type Search } from "@/lib/search-params";
import { NEW_LEAD_SUB, NEW_LEAD_TITLE, NewLead } from "./NewLead";

export const dynamic = "force-dynamic";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const draftId = Number(param(sp, "draft")) || null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title={NEW_LEAD_TITLE} sub={NEW_LEAD_SUB} />
      <NewLead
        draftId={draftId}
        cancel={
          <LinkButton variant="ghost" href="/leads">
            ยกเลิก
          </LinkButton>
        }
      />
    </div>
  );
}
