// The body of "เพิ่มทรัพย์ใหม่", shared by the page and the modal that
// intercepts it (app/(app)/@modal/(.)listings/new). Both render exactly this;
// what differs is the frame around it and what ยกเลิก does, which is why
// `cancel` is a node rather than an href.
//
// Still a SERVER component in both — it reads the option lists and the AI
// draft itself, so the modal costs the list page nothing until it is opened.

import type { ReactNode } from "react";
import { AiPasteBox } from "@/components/AiPasteBox";
import { getJobDraft } from "@/lib/ai/jobs";
import { aiConfigured } from "@/lib/ai/extract";
import { getViewer } from "@/lib/auth/session";
import {
  getAgentOptions,
  getProjectOptions,
  getStationOptions,
  getZoneOptions,
} from "@/lib/repo/listings";
import { createListing } from "../actions";
import { ListingForm } from "../ListingForm";

export const NEW_LISTING_TITLE = "เพิ่มทรัพย์ใหม่";
export const NEW_LISTING_SUB =
  "กรอกเท่าที่มี — สถานะเริ่มต้นคือ “ข้อมูลยังไม่ครบ”";

export async function NewListing({
  draftId,
  cancel,
}: {
  /** ?draft=<jobId> — the AI tray's "เปิดร่างในฟอร์ม". */
  draftId: number | null;
  cancel: ReactNode;
}) {
  const viewer = await getViewer();
  const [zones, agents, projects, stations] = await Promise.all([
    getZoneOptions(),
    getAgentOptions(),
    getProjectOptions(),
    getStationOptions(),
  ]);

  const job = draftId ? await getJobDraft(draftId) : null;
  const d = job?.kind === "listing" ? job.draft : null;
  const defaults = d
    ? {
        listingName: d.listingName,
        propertyType: d.propertyType,
        listingType: d.listingType,
        unitTypeName: d.unitTypeName,
        unitNo: d.unitNo,
        bed: d.bed,
        bath: d.bath,
        usableSqm: d.sqm != null ? String(d.sqm) : null,
        landRai: d.landRai != null ? String(d.landRai) : null,
        landNgan: d.landNgan != null ? String(d.landNgan) : null,
        landWa: d.landWa != null ? String(d.landWa) : null,
        floor: d.floor,
        building: d.building,
        view: d.view,
        direction: d.direction,
        position: d.position,
        parking: d.parking,
        unitCondition: d.unitCondition,
        askingPrice: d.askingPrice != null ? String(d.askingPrice) : null,
        rentalPrice: d.rentalPrice != null ? String(d.rentalPrice) : null,
        priceRemark: d.priceRemark,
        projectId: d.projectId,
      }
    : undefined;
  const ownerDefaults = d
    ? { name: d.ownerName, phone: d.ownerPhone, lineId: d.ownerLine }
    : undefined;

  return (
    <div className="space-y-5">
      {viewer.perms.aiParse && !d ? <AiPasteBox kind="listing" configured={aiConfigured()} /> : null}
      {job?.note ? (
        <p className="rounded-ctl bg-accent-soft px-4 py-2.5 text-sm text-accent-text">
          ✨ ร่างจาก AI: {job.note} — ตรวจทุกช่องก่อนบันทึก
        </p>
      ) : null}
      <ListingForm
        action={createListing}
        viewer={viewer}
        options={{ zones, agents, projects, stations }}
        defaults={defaults}
        ownerDefaults={ownerDefaults}
        // Create path — see the twin in NewLead.
        dedupe
        aiJobId={d ? draftId : null}
        cancel={cancel}
        submitLabel="บันทึกทรัพย์"
      />
    </div>
  );
}
