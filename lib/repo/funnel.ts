import "server-only";

/* ความเคลื่อนไหว — the pipeline card's three numbers.
   Ported from the Klaichan CRM dashboard, 2026-08-28.

   ─── THE FUNNEL IS A COHORT, WHICH IS WHY IT NESTS ────────────────────────
   It follows the leads that ARRIVED in the window and asks how far each one
   got, so every step counts everyone at-or-beyond it and the bars can only
   narrow. The percentages are therefore real conversion rates against a fixed
   group.

   The card this replaces counted leads CURRENTLY SITTING on each stage, which
   is a different thing and does not nest: a lead at Show was simply absent
   from Lead even though it plainly passed through, so the bars went up and
   down and no percentage could be drawn. Klaichan hit the same thing — Ben
   asked there why it did not accumulate from 100% down to Close, and it did
   not because it was never a funnel, only a snapshot.

   COHORTED BY ARRIVAL, not by "reached this stage during the window", because
   only a fixed group can produce a percentage that means anything. Counting
   arrivals per stage inside a window mixes cohorts — a lead that reached Show
   this month may have arrived in June — and the steps would stop nesting.

   ONE KNOWN LOSS vs Klaichan. Hers takes the furthest stage a lead ever
   reached, from a `lead_stage_events` log, because a lead pushed back from
   Nego to Follow has still REACHED Nego. Habihub has no such log — stage
   changes UPDATE the row in place — so this reads the CURRENT stage only and
   therefore under-reports every step above a setback. Klaichan's own query
   falls back to exactly this for the leads that predate her event log, so it
   is a degraded reading rather than a wrong one. Fixing it needs a
   lead_stage_events row written on every stage change; it starts empty, with
   no back-history.

   ─── งานที่ทำ IS NOT THE FUNNEL, AND THAT IS THE POINT ────────────────────
   Five calls to a buyer parked at Follow is five actions and zero movement;
   dragging one lead Lead → Call → Follow is two moves and maybe one call.
   Different units, so they are two VIEWS rather than two bars side by side —
   and both are indexed by stage, so flipping between them compares like with
   like. That is only possible because options.stage_key (0018) links an
   action category to the step it advances. */

import { and, asc, count, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { actions, leads, options } from "@/lib/db/schema";
import { notVoided } from "./activities";
import type { Viewer } from "@/lib/auth/session";
import { leadScope } from "./scope";
import { PIPELINE_STAGES } from "@/lib/labels";

/** Windows the card offers. Days, because a funnel needs a span long enough
    for a lead to travel it — a calendar month reads near-zero at the bottom
    on the 3rd. */
export const FUNNEL_WINDOWS = [30, 90, 180] as const;
export type FunnelWindow = (typeof FUNNEL_WINDOWS)[number];

export function isFunnelWindow(n: number): n is FunnelWindow {
  return (FUNNEL_WINDOWS as readonly number[]).includes(n);
}

export interface FunnelStep {
  stage: string;
  /** Leads from the cohort that got AT LEAST this far. Monotonically
      non-increasing down the funnel, by construction. */
  reached: number;
}

export interface OwnerRow {
  /** action_category key. */
  category: string;
  n: number;
}

export interface StageRow {
  stage: string;
  /** Actions logged against this step in the window. */
  n: number;
}

export interface PipelineData {
  days: number;
  /** Leads received inside the window — the 100% the funnel narrows from. */
  cohort: number;
  steps: FunnelStep[];
  /** งานที่ทำ, buyer half — actions per funnel step. */
  stageActions: StageRow[];
  /** งานที่ทำ, owner half — acquisition work, which advances no stage. */
  ownerActions: OwnerRow[];
}

/* The ::int cast is load-bearing, not decoration.

   The Neon HTTP driver sends bind params with no type OID, so Postgres has to
   infer one — and for `date - <unknown>` it resolves to `date - date`, not
   `date - integer`. The day count then gets parsed as a DATE and the whole
   query dies with `date/time field value out of range: "90"`. Verified
   against the branch, both ways round. Naming the type is the fix; every
   other date arithmetic in this codebase compares two typed COLUMNS, which is
   why nothing else hit it. */
const SINCE = (days: number) =>
  sql`((now() at time zone 'Asia/Bangkok')::date - ${days}::int)`;

const LEAD_ARRIVED = sql`(${leads.createdAt} at time zone 'Asia/Bangkok')::date`;

export async function getPipelineData(
  viewer: Viewer,
  days: number
): Promise<PipelineData> {
  const db = getDb();
  const since = SINCE(days);

  const [cohortRows, stageMap, ownerRows] = await Promise.all([
    // The cohort, by CURRENT stage. Small — one row per stage — so the
    // at-or-beyond accumulation happens in TypeScript against the stage order
    // rather than as a correlated subquery per step.
    db
      .select({ stage: leads.pipelineStage, n: count() })
      .from(leads)
      .where(and(sql`${LEAD_ARRIVED} >= ${since}`, leadScope(viewer)))
      .groupBy(leads.pipelineStage),

    // งานที่ทำ, buyer half. Joined through options.stage_key so an action
    // category counts toward the step it actually advances — never by having
    // the same name as one.
    db
      .select({ stage: options.stageKey, n: count() })
      .from(actions)
      .innerJoin(
        options,
        and(
          eq(options.kind, "action_category"),
          eq(options.key, actions.category),
          isNotNull(options.stageKey)
        )
      )
      .where(
        and(eq(actions.agentId, viewer.userId), gte(actions.date, since), notVoided)
      )
      .groupBy(options.stageKey),

    // งานที่ทำ, owner half. Ordered by the picklist so the rows read in the
    // order they are set in Settings.
    db
      // Non-null by the inner join below; told to the type system so the
      // NULL a plain note carries cannot leak into OwnerRow.
      .select({ category: sql<string>`${actions.category}`, n: count(), sort: options.sortOrder })
      .from(actions)
      .innerJoin(
        options,
        and(
          eq(options.kind, "action_category"),
          eq(options.key, actions.category),
          eq(options.scope, "owner")
        )
      )
      .where(
        and(eq(actions.agentId, viewer.userId), gte(actions.date, since), notVoided)
      )
      .groupBy(actions.category, options.sortOrder)
      .orderBy(asc(options.sortOrder)),
  ]);

  const byStage = new Map(cohortRows.map((r) => [r.stage as string, r.n]));
  const cohort = cohortRows.reduce((n, r) => n + r.n, 0);

  // AT OR BEYOND. Walking the stage order backwards and carrying a running
  // total is what makes the bars nest: everyone at Show has, by definition,
  // passed Appoint. A stage nobody currently sits on still shows everyone
  // downstream of it, which is exactly the reading the snapshot could not give.
  const steps: FunnelStep[] = [];
  let running = 0;
  for (let i = PIPELINE_STAGES.length - 1; i >= 0; i--) {
    running += byStage.get(PIPELINE_STAGES[i]) ?? 0;
    steps.unshift({ stage: PIPELINE_STAGES[i], reached: running });
  }

  const actionByStage = new Map(
    stageMap.map((r) => [r.stage as string, r.n])
  );

  return {
    days,
    cohort,
    steps,
    stageActions: PIPELINE_STAGES.map((stage) => ({
      stage,
      n: actionByStage.get(stage) ?? 0,
    })),
    ownerActions: ownerRows.map((r) => ({ category: r.category, n: r.n })),
  };
}
