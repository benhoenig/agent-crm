"use server";

/* ภาพรวมทีม mutations — currently one: setting an agent's monthly revenue
   target, which is what the hero's goal bar sums.

   SEPARATE FILE FROM dashboard-actions.ts, and the reason is the gate. That
   one is deliberately ungated because every statement in it is pinned to the
   caller's own `agentId`; this one writes a row belonging to SOMEBODY ELSE,
   so it needs a real permission check and does not belong under a header that
   explains why no check is needed.

   `targetsSet` is the check, and it is its own flag rather than a reuse of
   `goals` (Ben, 2026-08-29). Reading the whole team's board and DECIDING what
   the team is measured on are different acts, and the people who do them are
   not the same set: admin sees every goal and sets nobody's numbers. Manager
   is the only role that holds it.

   ANY MANAGER MAY SET ANY AGENT'S, not only their own reports. With two
   managers and five agents, scoping it to the reporting line would strand a
   target the moment somebody changed hands mid-quarter; `users.manager_id`
   records who someone sits under, and does not gate this. */

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { agentTargets } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { isTargetMetric, REVENUE_METRIC } from "@/lib/targets";

/** Set (or clear, with null) one agent's STANDING monthly commission target.

    Always period_key = '' — the standing figure — for the same reason
    dashboard-actions.ts setTarget is: a field labelled "ต่อเดือน" that
    silently wrote a dated row would mean "this month only", which is not what
    it says. */
async function writeTarget(
  agentId: string,
  metric: string,
  amount: number | null,
  by: string
) {
  const db = getDb();
  const where = and(
    eq(agentTargets.agentId, agentId),
    eq(agentTargets.metric, metric),
    eq(agentTargets.period, "month"),
    eq(agentTargets.periodKey, "")
  );

  if (amount === null || !Number.isFinite(amount) || amount < 0) {
    await db.delete(agentTargets).where(where);
    return;
  }

  const value = Math.round(amount);
  await db
    .insert(agentTargets)
    .values({
      agentId,
      metric,
      period: "month",
      periodKey: "",
      amount: value,
      updatedBy: by,
    })
    .onConflictDoUpdate({
      target: [
        agentTargets.agentId,
        agentTargets.metric,
        agentTargets.period,
        agentTargets.periodKey,
      ],
      set: { amount: value, updatedBy: by, updatedAt: new Date() },
    });
}

export async function setAgentRevenueTarget(
  agentId: string,
  amount: number | null
): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  if (!viewer.perms.targetsSet) return { ok: false };

  await writeTarget(agentId, REVENUE_METRIC, amount, viewer.userId);

  // The goal bar is a SUM across agents, so one edit changes a figure the
  // editing panel does not itself render. Revalidating the page is what keeps
  // the bar and the panel from disagreeing.
  revalidatePath("/");
  return { ok: true };
}

/** Set (or clear) one agent's monthly KPI target — the ผลงานตามกระบวนการขาย
    columns. Same store and same rules as the revenue figure above; the metric
    is validated against lib/targets.ts's namespaces so a forged one cannot
    mint a row nothing reads. */
export async function setAgentKpiTarget(
  agentId: string,
  metric: string,
  amount: number | null
): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  if (!viewer.perms.targetsSet || !isTargetMetric(metric)) return { ok: false };

  await writeTarget(agentId, metric, amount, viewer.userId);
  revalidatePath("/");
  return { ok: true };
}
