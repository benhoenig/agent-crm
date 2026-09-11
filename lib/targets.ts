/* What a target is ABOUT — the `agent_targets.metric` vocabulary.

   PORTED FROM the Klaichan CRM targets model, 2026-08-28, with one structural
   change: hers are COMPANY-WIDE (one operator, one set of numbers). Here every
   target belongs to an AGENT. The card that reads them renders only on the
   sales dashboard, scoped by leadScope(viewer) to that person's own leads, so
   a company figure overlaid on one agent's funnel would compare two different
   populations. `goals.agent_id` already made the same call.

   One text column carries every goal, namespaced rather than normalised into
   a second table. Every metric here is derived from a row that lives in
   Settings — a pipeline stage, an action category. Encoding the option's key
   into the metric means adding a stage gives it a targetable metric with no
   migration, and archiving one simply stops the metric being read, which a
   normalised foreign key would have turned into a delete-cascade decision.

   Client-safe: pure strings, no DB import. The card is a client component and
   names the same metrics the server resolves; two spellings of "stage:" that
   drift apart is a silent wrong number, not a type error. */

/** `stage:<pipeline stage>` — the buyer side.

    Keyed on the STAGE, not the action category, because that is what the row
    on screen is: several categories can advance one step, and a target per
    category could not be compared against the number displayed. */
export const STAGE_METRIC_PREFIX = "stage:";

/** `kind:<action_category key>` — the owner side.

    Owner Visit and Owner Talk advance no pipeline stage: acquisition happens
    before there is a buyer to move. So they are targeted per CATEGORY, which
    is the only unit they have. The asymmetry with `stage:` is the data
    model's, not a shortcut — `options.stage_key` is null for every
    owner-scope category. */
export const KIND_METRIC_PREFIX = "kind:";

/** `money:<what>` — a baht figure rather than a count.

    Only `money:commission` exists today: the monthly revenue an agent is
    expected to close. It lives here, alongside the activity targets, because
    it is the same KIND of thing — a standing rate with no name and no retro —
    and it is what the team dashboard's hero bar is scored against. A `goals`
    row could not stand in: those are named, dated commitments carrying their
    own [start, target] window, so a month picked on the dashboard would have
    to be pro-rated out of one, which lib/targets.ts refuses to do below for
    exactly the reason it refuses here.

    THE TEAM FIGURE IS THE SUM OF THE AGENTS', not a company row. `agent_targets`
    has a NOT NULL FK to users, so there is no company to hang one on, and
    inventing a sentinel user to carry it would be the worst kind of workaround.
    Summing is also the more honest number: a team target nobody's own target
    adds up to is a figure the team was never actually asked for. */
export const MONEY_METRIC_PREFIX = "money:";

/** Monthly closed-commission target, per agent. */
export const REVENUE_METRIC = "money:commission";

export const stageMetric = (stage: string) => STAGE_METRIC_PREFIX + stage;
export const kindMetric = (category: string) => KIND_METRIC_PREFIX + category;

/** Is this a metric the app can actually score something against?

    Checks the NAMESPACE, not that the option still exists. An archived stage
    keeps its target on purpose — the same reason archiving is not deleting
    everywhere else here: unarchive it and the number it was measured against
    is still the one that was set. What this does stop is a stale tab minting
    rows under a metric nothing reads, which would sit in the table forever
    looking like a goal. */
export function isTargetMetric(metric: string): boolean {
  for (const prefix of [
    STAGE_METRIC_PREFIX,
    KIND_METRIC_PREFIX,
    MONEY_METRIC_PREFIX,
  ]) {
    if (metric.startsWith(prefix) && metric.length > prefix.length) return true;
  }
  return false;
}

/** The period lengths a target can be set over. The LENGTH is stored, not a
    date range, which is what keeps the comparison honest under the card's
    window selector: a 30-day view scores against the monthly target, 90 days
    against the quarterly one, rather than pro-rating one number and lying
    about a business that is not flat across a year. */
export const TARGET_PERIODS = ["month", "quarter", "year"] as const;
export type TargetPeriod = (typeof TARGET_PERIODS)[number];

/** Which period a window of N days is scored against, and by how much the
    standing figure must be scaled to cover it.

    30 days → the monthly target as-is. 90 → the quarterly. 180 → the yearly,
    halved. Scaling is stated rather than hidden because a scaled target is
    NOT the number anyone typed, and the editor must always write back the
    unscaled standing figure. */
export function periodForDays(days: number): {
  period: TargetPeriod;
  scale: number;
} {
  if (days <= 31) return { period: "month", scale: 1 };
  if (days <= 100) return { period: "quarter", scale: 1 };
  return { period: "year", scale: days / 365 };
}
