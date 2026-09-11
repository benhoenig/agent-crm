// เป้ารายได้ — the sales dashboard's revenue card.
//
// READS THE MANAGER-SET MONTHLY TARGET, not a goal (Ben, 2026-08-29).
//
// It used to read getCurrentGoal(): the agent's own active เป้าหมาย, with a
// "+ ตั้งเป้าใหม่" button beside it. That button was the last place a sales
// agent could set their own revenue number, which contradicts the rule the
// rest of the app now follows — the manager owns the numbers, the agent is
// measured against them.
//
// IT ALSO ENDED A SPLIT NOBODY HAD RECONCILED. Revenue-versus-target could be
// read in two places against two different figures: this card scored the
// agent against a `goals` row, while รายได้ทีม on the team dashboard scored
// the team against the SUM of `agent_targets` monthly figures. A manager and
// a salesperson could look at the same month and disagree. There is one
// number now, and both cards read it.
//
// เป้าหมาย (/goals) KEEPS ITS JOB — the half that was always the useful one:
// a named, dated commitment with a retro attached ("Q3 push", what happened /
// why / improvement plan). What it stops being is a second revenue target.
//
// The window is THIS CALENDAR MONTH, which is what makes the comparison legal
// at all: the stored figure is monthly, so scoring it against anything else
// would mean pro-rating a number nobody typed.

import { Card, Pill } from "@/components/ui";
import { formatBaht } from "@/lib/format";
import { daysInMonth, monthLabel, monthKeyOf } from "@/lib/month-range";

export function TargetRevenueCard({
  target,
  actual,
  today,
}: {
  /** The agent's monthly commission target, set by their manager. */
  target: number | null;
  /** Commission closed inside this calendar month. */
  actual: number;
  today: string;
}) {
  const month = monthKeyOf(today);
  const day = Number(today.slice(8, 10));
  const span = daysInMonth(month);
  const left = span - day;

  if (target === null) {
    return (
      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">เป้ารายได้</h2>
          <span className="text-xs text-ink-3">{monthLabel(month)}</span>
        </div>
        <div className="num pt-3 text-2xl font-semibold">
          {formatBaht(actual)}
        </div>
        {/* No button, deliberately: there is nothing an agent can do here.
            Saying who sets it is more useful than an action that would be
            refused. */}
        <p className="pt-2 text-xs text-ink-3">
          ผู้จัดการยังไม่ได้ตั้งเป้ารายได้รายเดือนให้คุณ
        </p>
      </Card>
    );
  }

  const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
  // Clamp the BAR at 100% but never the number — overshooting should read as a
  // win, not as a full bar identical to exactly hitting it.
  const barPct = Math.min(100, Math.max(0, pct));
  const remaining = Math.max(0, target - actual);

  // Where the money should be by today if the month ran flat. Not a forecast —
  // a reference line, which is why it is phrased as a gap and not a verdict.
  const expected = target * (day / span);
  const behind = actual < expected;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">เป้ารายได้</h2>
          <p className="text-xs text-ink-3">{monthLabel(month)}</p>
        </div>
        <Pill tone={left <= 3 ? "warn" : "muted"}>
          {left <= 0 ? "วันสุดท้าย" : `เหลือ ${left} วัน`}
        </Pill>
      </div>

      <div className="flex items-end justify-between pt-4">
        <div>
          <div className="num text-2xl font-semibold">{formatBaht(actual)}</div>
          <div className="pt-0.5 text-xs text-ink-3">
            จากเป้า <span className="num">{formatBaht(target)}</span>
          </div>
        </div>
        <div
          className={`num text-xl font-semibold ${
            pct >= 100 ? "text-good" : "text-ink-2"
          }`}
        >
          {pct}%
        </div>
      </div>

      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-good" : "bg-accent"}`}
          style={{ width: `${barPct}%` }}
        />
        {/* Where the month is, against where the money is. The bar alone
            cannot say whether 60% on the 12th is good or terrible. */}
        <span
          className="absolute inset-y-0 w-px bg-ink/60"
          style={{ left: `${(day / span) * 100}%` }}
          title={`วันที่ ${day}/${span}`}
        />
      </div>

      <div className="flex items-center justify-between pt-2 text-xs">
        <span className="num text-ink-3">
          วันที่ {day}/{span}
        </span>
        <span className={`num ${pct >= 100 ? "text-good" : behind ? "text-bad" : "text-ink-3"}`}>
          {remaining > 0 ? `ขาดอีก ${formatBaht(remaining)}` : "ถึงเป้าแล้ว"}
        </span>
      </div>
    </Card>
  );
}
