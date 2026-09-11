"use server";

/* ความเคลื่อนไหว card mutations + its window refetch.

   NO PERMISSION GATE, and like the planner (app/(app)/plan/actions.ts) that
   is deliberate rather than an oversight. Every statement here is pinned to
   `agentId` taken from the SESSION, never from the request body, so the only
   targets anyone can read or write are their own. The card renders on the
   sales dashboard, which already shows only that person's leads — there is
   nothing here to authorise beyond being signed in.

   Target WRITES moved out on 2026-08-29 — see the note at the bottom. What is
   left is a pure refetch, which needs no gate at all. */

import { getViewer } from "@/lib/auth/session";
import {
  getPipelineData,
  isFunnelWindow,
  type PipelineData,
} from "@/lib/repo/funnel";

/** Refetch the card for a different window. The selector is on the card
    rather than in the URL because the dashboard has no range filter and one
    card's reading preference should not become a page-wide parameter. */
export async function fetchPipeline(days: number): Promise<PipelineData | null> {
  if (!isFunnelWindow(days)) return null;
  const viewer = await getViewer();
  return getPipelineData(viewer, days);
}

/* setTarget LIVED HERE until 2026-08-29, letting a sales agent set their own
   figures from ความเคลื่อนไหว. Removed rather than gated: a target you set for
   yourself is a self-assessment, and the whole point of the card scoring
   against one is that somebody else decided it. Setting now lives in
   app/(app)/overview-actions.ts behind `targetsSet`, which only the manager
   holds, and the sales card renders the number read-only. */
