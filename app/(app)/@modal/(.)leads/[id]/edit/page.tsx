// แก้ไขข้อมูล Lead, opened OVER the drawer. The twin of the listings editor
// modal — see that file for why this renders the drawer as well as the form.

import { RouteDrawer } from "@/components/ui/RouteDrawer";
import { RouteModal, ModalCancelButton } from "@/components/ui/RouteModal";
import { loadLeadDrawer } from "@/app/(app)/leads/[id]/LeadRecord";
import { EDIT_LEAD_SUB, loadLeadEditor } from "@/app/(app)/leads/[id]/edit/EditLead";

export const dynamic = "force-dynamic";

export default async function EditLeadModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [record, editor] = await Promise.all([
    loadLeadDrawer(id),
    loadLeadEditor(id, <ModalCancelButton />),
  ]);

  return (
    <>
      <RouteDrawer title={record.title} sub={record.sub} badges={record.badges}>
        {record.content}
      </RouteDrawer>
      <RouteModal title={editor.title} sub={EDIT_LEAD_SUB}>
        {editor.form}
      </RouteModal>
    </>
  );
}
