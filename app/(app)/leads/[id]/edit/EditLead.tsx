// The lead edit form's queries and markup, shared by the intercepted modal
// and the hard-load page. The twin of listings/[id]/edit/EditListing.tsx —
// see that file for why this shape.

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getViewer } from "@/lib/auth/session";
import { getLead, listingOptions } from "@/lib/repo/leads";
import { getAgentOptions } from "@/lib/repo/listings";
import { updateLead } from "../../actions";
import { LeadForm } from "../../LeadForm";

export const EDIT_LEAD_SUB =
  "ข้อมูลผู้ติดต่อจะอัปเดตลงรายชื่อลูกค้าเดิมที่ผูกกับ Lead นี้";

export async function loadLeadEditor(
  id: string,
  cancel: ReactNode
): Promise<{ title: string; form: ReactNode }> {
  const viewer = await getViewer();
  const [detail, listings, agents] = await Promise.all([
    getLead(viewer, id),
    listingOptions(viewer),
    viewer.perms.intakeAssign ? getAgentOptions() : Promise.resolve([]),
  ]);
  if (!detail) notFound();

  return {
    title: `แก้ไข: ${detail.contact?.name ?? "Lead"}`,
    form: (
      <LeadForm
        action={updateLead.bind(null, id)}
        viewer={viewer}
        listings={listings}
        agents={agents}
        defaults={detail.lead}
        contactDefaults={
          detail.contact
            ? {
                name: detail.contact.name,
                phone: detail.contact.phone,
                lineId: detail.contact.lineId,
                email: detail.contact.email,
              }
            : null
        }
        cancel={cancel}
        submitLabel="บันทึกการแก้ไข"
      />
    ),
  };
}
