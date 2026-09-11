import { pgEnum } from "drizzle-orm/pg-core";

// WORKFLOW enums only — states the app branches on structurally, never
// client vocabulary. The business vocabularies (listing status, property
// type, marketing channel, …) were converted to the `options` table on
// 2026-08-23 (pre-launch) so the client can edit them in Settings; their
// initial values live in lib/options/seed.ts, verbatim from the HABIHUB
// Database "Resources" tab (read 2026-08-15) per DATA_MODEL §2.

// Funnel order is code logic (dashboard funnel, pipeline board, LINE card).
export const pipelineStage = pgEnum("pipeline_stage", [
  "Lead",
  "Call",
  "Follow",
  "Appoint",
  "Show",
  "Nego",
  "Close",
  "Win",
]);

export const recap = pgEnum("recap", ["Work", "Not Work"]);

export const goalStatus = pgEnum("goal_status", [
  "Planned",
  "In Progress",
  "Success!",
  "Failed",
  "Cancel",
]);

export const stationType = pgEnum("station_type", ["BTS", "MRT", "ARL"]);

export const slaEntity = pgEnum("sla_entity", [
  "listing_follow",
  "listing_post",
  "lead_follow",
]);

export const mediaKind = pgEnum("media_kind", [
  "original",
  "new_photo",
  "shorts_reel",
  "hometour",
]);

// App-defined workflow states (not sheet vocabulary).
export const listingUpdateStatus = pgEnum("listing_update_status", [
  "pending",
  "approved",
  "rejected",
  "applied",
]);

export const dealDocType = pgEnum("deal_doc_type", [
  "closed_case_file",
  "receipt",
  "spa",
  "agent_agreement",
  "other",
]);

export const leaveType = pgEnum("leave_type", [
  "sick",
  "personal",
  "vacation",
  "other",
]);

export const leaveStatus = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);
