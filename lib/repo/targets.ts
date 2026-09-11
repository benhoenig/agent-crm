import "server-only";

/* Per-agent activity targets — resolution only; the writes live in
   app/(app)/dashboard-actions.ts.

   TWO LEVELS. A row with period_key = '' is the STANDING target for that
   period length ("12 shows a month"); a row with a real key ('2026-08')
   overrides that one period. Resolution prefers the exact key and falls back
   to the standing row, so a seasonal month can be set without re-entering
   every other month and the common case stays one number typed once. */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agentTargets } from "@/lib/db/schema";
import type { TargetPeriod } from "@/lib/targets";

export interface ResolvedTargets {
  /** metric → the figure to score against for THIS window, already scaled. */
  effective: Record<string, number>;
  /** metric → the UNSCALED standing figure, which is what the editor shows
      and writes back. Keeping them apart is what stops a scaled number ever
      being saved as if someone had typed it. */
  standing: Record<string, number>;
}

export async function targetsFor(
  agentId: string,
  period: TargetPeriod,
  scale: number,
  periodKey: string
): Promise<ResolvedTargets> {
  const rows = await getDb()
    .select({
      metric: agentTargets.metric,
      periodKey: agentTargets.periodKey,
      amount: agentTargets.amount,
    })
    .from(agentTargets)
    .where(
      and(
        eq(agentTargets.agentId, agentId),
        eq(agentTargets.period, period),
        inArray(agentTargets.periodKey, ["", periodKey])
      )
    );

  const standingRows = new Map<string, number>();
  const overrideRows = new Map<string, number>();
  for (const r of rows) {
    (r.periodKey === "" ? standingRows : overrideRows).set(r.metric, r.amount);
  }

  const standing: Record<string, number> = {};
  const effective: Record<string, number> = {};
  for (const metric of new Set([...standingRows.keys(), ...overrideRows.keys()])) {
    const base = overrideRows.get(metric) ?? standingRows.get(metric)!;
    // The editor always shows and writes the STANDING figure, even when an
    // override is what is being displayed — otherwise saving an untouched
    // field would silently promote an override into the standing row.
    standing[metric] = standingRows.get(metric) ?? base;
    effective[metric] = Math.round(base * scale);
  }
  return { effective, standing };
}
