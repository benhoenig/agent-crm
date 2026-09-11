/* What the แนวโน้ม chart can plot — the metric registry.

   CLIENT-SAFE, for the same reason lib/targets.ts is: the chart is a client
   component that names a metric, the repository fills the same key, and two
   spellings that drift apart is a silently wrong line rather than a type
   error.

   FIXED CORE + DYNAMIC TAIL. The five core metrics below are columns of
   tables that exist (deals, leads, listings, actions), so they are named
   here. Everything after them is one line per `action_category` option, built
   on the server from the picklist — adding a category in Settings gives it a
   plottable series with no code change, and archiving one stops it being
   offered. That is the same rule lib/targets.ts follows for `kind:`.

   Ported from the Habihub Sales Dashboard's hooks/metrics.js ANNUAL_METRICS
   (Ben, 2026-08-28). Hers reads flat summary sheets; ours reads the source
   tables, so the metric list is the part that carries over, not the plumbing. */

export type MetricFormat = "baht" | "count";

export interface TeamMetric {
  key: string;
  label: string;
  fmt: MetricFormat;
  /** Gets a pill button. The rest live in the "อื่นๆ" dropdown — a row of
      twenty pills is a menu pretending to be a toolbar. */
  primary?: boolean;
}

/** `act:<action_category key>` — one series per logged activity type. */
export const ACTION_METRIC_PREFIX = "act:";
export const actionMetric = (category: string) =>
  ACTION_METRIC_PREFIX + category;

export const CORE_TEAM_METRICS: TeamMetric[] = [
  { key: "revenue", label: "รายได้", fmt: "baht", primary: true },
  { key: "new_leads", label: "ลีดใหม่", fmt: "count", primary: true },
  { key: "closed_deals", label: "ปิดดีล", fmt: "count", primary: true },
  { key: "new_listings", label: "ทรัพย์ใหม่", fmt: "count" },
  { key: "actions_total", label: "แอคชั่นทั้งหมด", fmt: "count" },
];

/** Metrics that read the `deals` table. Withheld from a viewer whose deal
    scope is "none" (listing support) — plotting a flat ฿0 line and calling it
    the team's revenue is worse than not offering it. */
export const DEAL_METRICS = new Set(["revenue", "closed_deals"]);
