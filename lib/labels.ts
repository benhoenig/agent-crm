// Tone/label maps for the WORKFLOW enums (lib/db/schema/enums.ts). Business
// vocabularies (listing status, potential, …) moved to the `options` table
// (2026-08-23) — their tones now come from lib/repo/options.ts toneMap(),
// paired with the same `toneFor` helper.

import type { Tone } from "@/components/ui";

export function toneFor(
  map: Record<string, Tone>,
  value: string | null | undefined,
  fallback: Tone = "muted"
): Tone {
  return (value && map[value]) || fallback;
}

export const PIPELINE_STAGES = [
  "Lead",
  "Call",
  "Follow",
  "Appoint",
  "Show",
  "Nego",
  "Close",
  "Win",
] as const;

export const PIPELINE_STAGE_TONE: Record<string, Tone> = {
  Lead: "muted",
  Call: "muted",
  Follow: "info",
  Appoint: "info",
  Show: "warn",
  Nego: "warn",
  Close: "good",
  Win: "accent",
};

export const RECAP_TONE: Record<string, Tone> = {
  Work: "good",
  "Not Work": "bad",
};

export const GOAL_STATUS_TONE: Record<string, Tone> = {
  Planned: "muted",
  "In Progress": "info",
  "Success!": "accent",
  Failed: "bad",
  Cancel: "muted",
};

export const LEAVE_STATUS_TONE: Record<string, Tone> = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
  cancelled: "muted",
};

export const LEAVE_TYPE_LABEL: Record<string, string> = {
  sick: "ลาป่วย",
  personal: "ลากิจ",
  vacation: "ลาพักร้อน",
  other: "อื่นๆ",
};

export const LISTING_UPDATE_STATUS_TONE: Record<string, Tone> = {
  pending: "warn",
  approved: "info",
  rejected: "bad",
  applied: "good",
};

export const LISTING_UPDATE_STATUS_LABEL: Record<string, string> = {
  pending: "รอตรวจ",
  approved: "อนุมัติแล้ว",
  rejected: "ตีกลับ",
  applied: "แก้ไขแล้ว",
};

/** Row-aware label: a pending "status" row is the portal-sync handoff (the
    sheet-era ✅ twin — support still owes the portals a mirror of the CRM
    status), not a change request awaiting review. */
export function listingUpdateRowLabel(
  status: string,
  columnName: string | null
): string {
  if (status === "pending" && columnName === "status") return "รออัปเดตพอร์ทัล";
  return LISTING_UPDATE_STATUS_LABEL[status] ?? status;
}

export const DEAL_DOC_TYPE_LABEL: Record<string, string> = {
  closed_case_file: "ไฟล์ปิดเคส",
  receipt: "ใบเสร็จ",
  spa: "สัญญาจะซื้อจะขาย (SPA)",
  agent_agreement: "สัญญาแต่งตั้งนายหน้า",
  other: "อื่นๆ",
};

export const MEDIA_KIND_LABEL: Record<string, string> = {
  original: "รูปต้นฉบับ",
  new_photo: "รูปถ่ายใหม่",
  shorts_reel: "Shorts / Reel",
  hometour: "Home Tour",
};

