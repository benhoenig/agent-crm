"use client";

/* รายได้ทีม — the one number this page exists to show.

   Ported from the Habihub Sales Dashboard's HeroProgress (Ben, 2026-08-28).
   It replaces the four stat tiles that led this page: those were four
   unrelated figures at equal weight, which makes a reader choose what matters
   before they have read anything. One number at hero size, with the three
   things that give it meaning — where it was, where it should be, and where
   it is heading — is the whole point of the source's layout.

   TWO DIVERGENCES FROM THE SOURCE, both deliberate:

   1. NO HARDCODED FALLBACK TARGET. Hers falls back to a 3,000,000 constant
      when the target sheet is unreadable, so the bar always draws. Here an
      unset target means the goal bar is simply absent — a progress bar
      against a number nobody set is a made-up score, and this is the screen
      people are judged on.

   2. THE TARGET IS EDITABLE IN PLACE. The source sets targets on a separate
      CEO tab. Setting one is the same act as reading the bar it draws, and
      the team roster is right here, so the editor is a panel on the card —
      gated on `goals: "all"`, which is already the "may see and set the whole
      team's targets" permission.

   THE TEAM TARGET IS A SUM of each agent's own monthly figure; see
   lib/targets.ts REVENUE_METRIC for why there is no company-level row. */

import { useState, useTransition } from "react";
import { Check, LoaderCircle, Target, X } from "lucide-react";
import { Card, Input } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { bahtShort, formatBaht, formatNum } from "@/lib/format";
import { daysInMonth, monthKeyOf, rangeLabel, type MonthRange } from "@/lib/month-range";
import { setAgentRevenueTarget } from "@/app/(app)/overview-actions";
import type { RevenueTargetRow, TeamRevenue } from "@/lib/repo/team-overview";

export function TeamRevenueHero({
  range,
  months,
  today,
  revenue,
  targets,
  canEdit,
}: {
  range: MonthRange;
  /** How many months the range covers — the monthly targets' multiplier. */
  months: number;
  today: string;
  revenue: TeamRevenue;
  targets: RevenueTargetRow[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const goal =
    targets.reduce((n, t) => n + (t.monthly ?? 0), 0) * months;

  // Pace is only shown for the CURRENT month alone. Projecting a finished
  // month is meaningless, and projecting a multi-month span from elapsed days
  // assumes the business is flat across it — the same assumption lib/targets.ts
  // refuses to make when scaling a target.
  const currentMonth = monthKeyOf(today);
  const live = range.from === range.to && range.to === currentMonth;
  const day = Number(today.slice(8, 10));
  const span = daysInMonth(currentMonth);
  const projected = live && day > 0 ? Math.round((revenue.total * span) / day) : null;

  const delta =
    revenue.prevTotal > 0
      ? Math.round(((revenue.total - revenue.prevTotal) / revenue.prevTotal) * 100)
      : null;

  const pct = goal > 0 ? Math.min(100, (revenue.total / goal) * 100) : 0;
  const onPace = projected !== null && goal > 0 ? projected >= goal : null;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs tracking-wide text-ink-3 uppercase">
            รายได้ · {rangeLabel(range)}
          </div>
          <div className="num pt-2 text-[2.6rem] leading-none font-semibold tracking-tight">
            {formatBaht(revenue.total)}
          </div>
        </div>
        {/* A LABELLED BUTTON, NOT AN ICON (Ben, 2026-08-29: "it took me a while
            to find it"). A bare 🎯 in a card corner is discoverable only by
            hovering everything — and this is the one control on the screen a
            manager comes here to use, so it gets the primary-action treatment
            the app already uses for "+ บันทึก" on the plan card. */}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-pressed={editing}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-ctl px-3 py-1.5 text-[0.78rem] font-semibold transition-colors ${
              editing
                ? "bg-surface-3 text-ink hover:bg-line"
                : "bg-accent text-accent-ink hover:bg-accent-hover"
            }`}
          >
            <Target size={14} />
            {editing ? "ปิด" : "ตั้งเป้า"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-2 pt-3 text-xs">
        {delta !== null && delta !== 0 && (
          <span
            className={`num font-semibold ${delta > 0 ? "text-good" : "text-bad"}`}
          >
            {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}%
          </span>
        )}
        <span className="text-ink-3">
          เทียบ{months === 1 ? "เดือนก่อน" : "ช่วงก่อน"} ·{" "}
          <span className="num">{formatBaht(revenue.prevTotal)}</span>
        </span>
        <span className="text-line-strong">·</span>
        <span className="text-ink-3">
          <span className="num">{formatNum(revenue.deals)}</span> ดีล
        </span>
        {projected !== null && (
          <>
            <span className="text-line-strong">·</span>
            <span
              className={
                onPace === null
                  ? "text-ink-3"
                  : onPace
                    ? "text-good"
                    : "text-bad"
              }
            >
              คาดสิ้นเดือน <span className="num">{bahtShort(projected)}</span>
            </span>
          </>
        )}
      </div>

      {goal > 0 ? (
        <div className="pt-5">
          <div className="flex justify-between pb-1.5 text-[0.7rem] text-ink-3">
            <span>
              เป้า · <span className="num">{formatBaht(goal)}</span>
            </span>
            <span className="num font-semibold text-ink">
              {Math.round(pct)}%
            </span>
          </div>
          {/* rounded-full, not rounded-ctl: the control radius (10px) exceeds
              half of a 10px bar and squares the ends off. */}
          <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
            {/* Where the month is, against where the money is. The bar alone
                cannot say whether 60% on the 12th is good or terrible. */}
            {live && (
              <span
                className="absolute inset-y-0 w-px bg-ink/60"
                style={{ left: `${(day / span) * 100}%` }}
                title={`วันที่ ${day}/${span}`}
              />
            )}
          </div>
          {live && (
            <div className="flex justify-between pt-1.5 text-[0.68rem] text-ink-3">
              <span className="num">
                วันที่ {day}/{span}
              </span>
              <span className={onPace ? "text-good" : "text-bad"}>
                {onPace ? "ทันเป้า" : "ช้ากว่าเป้า"}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="pt-5 text-[0.72rem] text-ink-3">
          ยังไม่ได้ตั้งเป้ารายเดือนของทีม
          {canEdit && " — กดไอคอนเป้าเพื่อตั้งรายคน"}
        </p>
      )}

      {editing && <TargetEditor rows={targets} months={months} />}
    </Card>
  );
}

/** The per-agent panel behind the target icon. Every row writes its own
    standing monthly figure; the bar above is their sum times the months in
    range, which is why the panel states the multiplier rather than showing a
    scaled number nobody typed. */
function TargetEditor({
  rows,
  months,
}: {
  rows: RevenueTargetRow[];
  months: number;
}) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-2 pb-2">
        <h3 className="text-[0.78rem] font-semibold">เป้ารายเดือนของแต่ละคน</h3>
        <p className="text-[0.68rem] text-ink-3">
          {months === 1 ? "เป้าทีม = ผลรวม" : `เป้าทีม = ผลรวม × ${months} เดือน`}
        </p>
      </div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <TargetRow key={r.id} row={r} />
        ))}
      </ul>
    </div>
  );
}

function TargetRow({ row }: { row: RevenueTargetRow }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(row.monthly ?? ""));
  const [pending, start] = useTransition();

  function save() {
    const raw = draft.trim();
    const n = raw === "" ? null : Number(raw);
    start(async () => {
      await setAgentRevenueTarget(row.id, n);
      setEditing(false);
    });
  }

  return (
    <li className={`flex items-center gap-2 ${pending ? "opacity-50" : ""}`}>
      <Avatar image={row.image} name={row.name} size="size-6 text-[0.6rem]" />
      <span className="min-w-0 flex-1 truncate text-xs text-ink-2">
        {row.name}
      </span>
      {editing ? (
        <span className="flex shrink-0 items-center gap-1">
          <Input
            autoFocus
            type="number"
            min={0}
            step={10000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-7 w-28 px-2 py-0 text-xs"
            aria-label={`เป้ารายเดือนของ ${row.name}`}
          />
          <button
            type="button"
            onClick={save}
            aria-label="บันทึก"
            className="grid size-6 place-items-center rounded text-good hover:bg-good-soft"
          >
            {pending ? (
              <LoaderCircle size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label="ยกเลิก"
            className="grid size-6 place-items-center rounded text-ink-3 hover:bg-surface-3"
          >
            <X size={12} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(row.monthly ?? ""));
            setEditing(true);
          }}
          className="num shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          {row.monthly === null ? "ตั้งเป้า" : formatBaht(row.monthly)}
        </button>
      )}
    </li>
  );
}
