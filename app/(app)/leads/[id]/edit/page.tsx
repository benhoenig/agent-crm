// HARD LOADS ONLY, now — a click on แก้ไขข้อมูล Lead from inside the drawer is
// intercepted into app/(app)/@modal/(.)leads/[id]/edit. See the listings twin.

import { LinkButton, PageHeader } from "@/components/ui";
import { EDIT_LEAD_SUB, loadLeadEditor } from "./EditLead";

export const dynamic = "force-dynamic";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { title, form } = await loadLeadEditor(
    id,
    <LinkButton variant="ghost" href={`/leads/${id}`}>
      ยกเลิก
    </LinkButton>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title={title} sub={EDIT_LEAD_SUB} />
      {form}
    </div>
  );
}
