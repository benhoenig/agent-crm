// The body of "เพิ่ม Lead ใหม่", shared by the page and the modal that
// intercepts it (app/(app)/@modal/(.)leads/new). See the listing twin in
// app/(app)/listings/new/NewListing.tsx for why `cancel` is a node.

import type { ReactNode } from "react";
import { AiPasteBox } from "@/components/AiPasteBox";
import { getJobDraft } from "@/lib/ai/jobs";
import { aiConfigured } from "@/lib/ai/extract";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { listingOptions } from "@/lib/repo/leads";
import { getAgentOptions } from "@/lib/repo/listings";
import { createLead } from "../actions";
import { LeadForm } from "../LeadForm";

export const NEW_LEAD_TITLE = "เพิ่ม Lead ใหม่";
export const NEW_LEAD_SUB =
  "กรอกเท่าที่มี — ระบบจับคู่ลูกค้าเดิมจากเบอร์โทรอัตโนมัติ";

export async function NewLead({
  draftId,
  cancel,
}: {
  /** ?draft=<jobId> — the AI tray's "เปิดร่างในฟอร์ม". */
  draftId: number | null;
  cancel: ReactNode;
}) {
  const viewer = await getViewer();
  // Guards BOTH routes that render this body — the page and the intercepted
  // modal — because it is the body, not the route, that every entry point
  // has in common. createLead refuses the post regardless; this is so the
  // form is never drawn for someone whose save cannot land.
  if (!viewer.perms.leadCreate) redirect("/leads");

  const [listings, agents] = await Promise.all([
    listingOptions(viewer),
    viewer.perms.intakeAssign ? getAgentOptions() : Promise.resolve([]),
  ]);

  const job = draftId ? await getJobDraft(draftId) : null;
  const d = job?.kind === "lead" ? job.draft : null;
  const defaults = d
    ? {
        potential: d.potential,
        source: d.channel,
        budgetMillion: d.budgetMillion != null ? String(d.budgetMillion) : null,
        listingId: d.listingId,
        initialInterest: d.initialInterest,
        background: d.background,
        requirement: d.requirement,
        painPoint: d.painPoint,
        timeline: d.timeline,
      }
    : undefined;
  const contactDefaults = d
    ? { name: d.name, phone: d.phone, lineId: d.lineId, email: null }
    : undefined;

  return (
    <div className="space-y-5">
      {viewer.perms.aiParse && !d ? <AiPasteBox kind="lead" configured={aiConfigured()} /> : null}
      {job?.note ? (
        <p className="rounded-ctl bg-accent-soft px-4 py-2.5 text-sm text-accent-text">
          ✨ ร่างจาก AI: {job.note} — ตรวจทุกช่องก่อนบันทึก
        </p>
      ) : null}
      <LeadForm
        action={createLead}
        viewer={viewer}
        listings={listings}
        agents={agents}
        defaults={defaults}
        contactDefaults={contactDefaults}
        // Create path: check the book for whoever the draft named, before
        // this becomes a second row for a customer we already have. Costs
        // nothing on an empty form — the search needs two characters.
        dedupe
        aiJobId={d ? draftId : null}
        cancel={cancel}
        submitLabel="บันทึก Lead"
      />
    </div>
  );
}
