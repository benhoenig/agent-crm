"use client";

/* ความเคลื่อนไหว — what happened in the window, split into the two sides of
   the business. Ported from the Klaichan CRM dashboard, 2026-08-28, replacing
   PipelineStageCard's position snapshot.

   THE SPLIT COMES FROM THE DATA MODEL, not a list in this file.
   `options.scope` (0018) says whether an action category belongs to the
   owner's side (signing up a unit, talking to a landlord) or the buyer's
   (a showing, a follow-up), so the halves can never drift from Settings.

   ฝั่งเจ้าของ is on top because it comes first in reality: there is no
   pipeline until somebody signs up a unit to sell.

   ───────────────────────────────────────────────────────────────────────────
   THE BUYER SIDE HAS TWO VIEWS, AND BOTH ARE KEYED TO THE FUNNEL

   Putting stage MOVEMENT opposite owner actions in identical bars was the
   first mistake made in Klaichan, and Ben caught it there: those are
   different units, and only one of them is work you did. Five calls to a
   buyer parked at Follow is five actions and zero movement; dragging one lead
   Lead → Call → Follow is two moves and maybe one call. Hence the toggle:

     งานที่ทำ (default)  how many ACTIONS you logged at each funnel step
     กรวยการขาย          how far the leads that ARRIVED in this window got

   Both are indexed BY STAGE — same rows, same words — so flipping between
   them compares like with like. That is only possible because
   options.stage_key links an action category to the step it advances.

   งานที่ทำ is the default because effort is what you control.

   THE FUNNEL IS A COHORT AND THEREFORE NESTS: every step counts everyone
   at-or-beyond it, so the bars can only narrow and the percentages are real
   conversion rates. See lib/repo/funnel.ts, including the one thing this
   loses against Klaichan (no stage-event log, so a lead pushed backwards
   under-reports the steps above it). */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { LoaderCircle, Target } from "lucide-react";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { formatNum } from "@/lib/format";
import { kindMetric, stageMetric } from "@/lib/targets";
import { fetchPipeline } from "@/app/(app)/dashboard-actions";
import type { PipelineData } from "@/lib/repo/funnel";

type BuyerView = "actions" | "funnel";

const WINDOWS = [
  { days: 30, label: "30 วัน" },
  { days: 90, label: "90 วัน" },
  { days: 180, label: "180 วัน" },
];

/* Remembered per browser, not per account: which number you want to see is a
   reading preference that changes with the question you are asking, and
   round-tripping it through the server would make a toggle feel like a save.
   Wrapped because localStorage throws outright in a few contexts (private
   windows, blocked site data). */
const PREF_KEY = "hh.dashboard.pipeline";
type Pref = { view?: BuyerView; days?: number; targets?: boolean };

function readPref(): Pref {
  try {
    return JSON.parse(window.localStorage.getItem(PREF_KEY) ?? "{}") as Pref;
  } catch {
    return {};
  }
}
function writePref(p: Pref) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify({ ...readPref(), ...p }));
  } catch {
    /* ignore */
  }
}

interface Row {
  key: string;
  label: string;
  n: number;
  /** Dim second column — the funnel's conversion %. */
  sub?: string;
  /** The target for this row over this window, when one is set and showing. */
  target?: number;
  /** `agent_targets.metric` this row is scored against. */
  metric: string;
  href?: string;
}

export function StageActivityCard({
  initial,
  targets,
}: {
  initial: PipelineData;
  /** Resolved for the INITIAL window. Recomputed on the server when the
      window changes, alongside the data. */
  targets: { effective: Record<string, number>; standing: Record<string, number> };
}) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<BuyerView>("actions");
  const [showTargets, setShowTargets] = useState(false);
  const [pending, start] = useTransition();

  // Preferences are read after mount so the server render and the first
  // client render agree; a mismatch here would hydrate-error the dashboard.
  useEffect(() => {
    const p = readPref();
    if (p.view) setView(p.view);
    if (p.targets !== undefined) setShowTargets(p.targets);
    if (p.days && p.days !== initial.days) changeWindow(p.days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeWindow(days: number) {
    writePref({ days });
    start(async () => {
      const next = await fetchPipeline(days);
      if (next) setData(next);
    });
  }

  function pickView(v: BuyerView) {
    setView(v);
    writePref({ view: v });
  }

  const ownerRows: Row[] = data.ownerActions.map((r) => ({
    key: `owner:${r.category}`,
    label: r.category,
    n: r.n,
    metric: kindMetric(r.category),
  }));

  const buyerRows: Row[] =
    view === "funnel"
      ? data.steps.map((s) => ({
          key: `stage:${s.stage}`,
          label: s.stage,
          n: s.reached,
          sub:
            data.cohort > 0
              ? `${Math.round((s.reached / data.cohort) * 100)}%`
              : undefined,
          metric: stageMetric(s.stage),
          href: `/leads?stage=${encodeURIComponent(s.stage)}`,
        }))
      : data.stageActions.map((s) => ({
          key: `act:${s.stage}`,
          label: s.stage,
          n: s.n,
          metric: stageMetric(s.stage),
          href: `/leads?stage=${encodeURIComponent(s.stage)}`,
        }));

  // Targets score EFFORT, not the cohort. A funnel step's count is a property
  // of the leads that happened to arrive, so "12 shows" is a goal about work
  // done, and overlaying it on กรวยการขาย would compare a target against a
  // number you only partly control.
  const withTargets = (rows: Row[]) =>
    rows.map((r) => ({
      ...r,
      target: showTargets ? targets.effective[r.metric] : undefined,
    }));

  const funnelView = view === "funnel";
  const maxOwner = Math.max(...ownerRows.map((r) => r.n), 1);
  const maxBuyer = Math.max(...buyerRows.map((r) => r.n), 1);

  return (
    <Card>
      <CardHeader
        title="ความเคลื่อนไหว"
        action={
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full bg-surface-3 p-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w.days}
                  type="button"
                  onClick={() => changeWindow(w.days)}
                  aria-pressed={w.days === data.days}
                  disabled={pending}
                  className={`rounded-full px-2 py-1 text-[0.7rem] font-medium transition-colors disabled:opacity-50 ${
                    w.days === data.days
                      ? "bg-surface text-ink shadow-card"
                      : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowTargets((t) => {
                  writePref({ targets: !t });
                  return !t;
                });
              }}
              aria-pressed={showTargets}
              aria-label={showTargets ? "ซ่อนเป้า" : "แสดงเป้า"}
              title={showTargets ? "ซ่อนเป้า" : "แสดงเป้า"}
              className={`grid size-7 place-items-center rounded-full transition-colors ${
                showTargets
                  ? "bg-accent-soft text-accent-text"
                  : "text-ink-3 hover:bg-surface-3 hover:text-ink"
              }`}
            >
              {pending ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <Target size={13} />
              )}
            </button>
          </div>
        }
      />

      <div className={`px-5 pb-5 ${pending ? "opacity-60" : ""}`}>
        {/* ── ฝั่งเจ้าของ ─────────────────────────────────────────────── */}
        <SectionTitle
          title="ฝั่งเจ้าของ"
          hint="งานหาทรัพย์ — ไม่ขยับสเตจของผู้ซื้อ"
        />
        {ownerRows.length === 0 ? (
          <p className="pb-4 text-[0.75rem] text-ink-3">
            ยังไม่มีงานฝั่งเจ้าของในช่วงนี้
          </p>
        ) : (
          <BarList rows={withTargets(ownerRows)} max={maxOwner} showTargets={showTargets} />
        )}

        {/* ── ฝั่งผู้ซื้อ ──────────────────────────────────────────────── */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <SectionTitle
            title="ฝั่งผู้ซื้อ"
            hint={
              funnelView
                ? `Lead ที่เข้ามาใน ${data.days} วัน · ${formatNum(data.cohort)} ราย`
                : `งานที่บันทึกใน ${data.days} วัน`
            }
            flush
          />
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface-3 p-0.5">
            {(
              [
                ["actions", "งานที่ทำ"],
                ["funnel", "กรวยการขาย"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => pickView(id)}
                aria-pressed={view === id}
                className={`rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition-colors ${
                  view === id
                    ? "bg-surface text-ink shadow-card"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {funnelView && data.cohort === 0 ? (
          <EmptyState
            title="ยังไม่มี Lead เข้ามาในช่วงนี้"
            hint="ลองขยายช่วงเวลาด้านบน"
          />
        ) : (
          <BarList
            rows={withTargets(buyerRows)}
            max={funnelView ? Math.max(data.cohort, 1) : maxBuyer}
            /* Targets are about effort, so they are shown only on งานที่ทำ. */
            showTargets={showTargets && !funnelView}
          />
        )}
      </div>
    </Card>
  );
}

function SectionTitle({
  title,
  hint,
  flush,
}: {
  title: string;
  hint: string;
  flush?: boolean;
}) {
  return (
    <div className={flush ? "" : "pb-2"}>
      <h3 className="text-[0.78rem] font-semibold">{title}</h3>
      <p className="text-[0.7rem] text-ink-3">{hint}</p>
    </div>
  );
}

function BarList({
  rows,
  max,
  showTargets,
}: {
  rows: Row[];
  max: number;
  showTargets: boolean;
}) {
  return (
    <ul className="space-y-1.5 pt-1">
      {rows.map((r) => (
        <BarRow key={r.key} row={r} max={max} showTargets={showTargets} />
      ))}
    </ul>
  );
}

function BarRow({
  row,
  max,
  showTargets,
}: {
  row: Row;
  max: number;
  showTargets: boolean;
}) {
  const pct = max > 0 ? (row.n / max) * 100 : 0;
  // A target of zero draws differently from no target at all — one is a goal
  // deliberately set to nothing, the other is silence.
  const hasTarget = row.target !== undefined;
  const hit = hasTarget && row.n >= row.target!;

  const label = (
    <>
      <span className="w-[4.5rem] shrink-0 truncate text-xs text-ink-2" title={row.label}>
        {row.label}
      </span>
      {/* bg-accent, not bg-accent-soft: the soft token is a 12%-alpha WASH
          meant for chip backgrounds behind text, and at bar size it reads as
          barely-there grey. The bar IS the data here, so it gets the full
          accent. rounded-full rather than rounded-ctl because the ctl radius
          (10px) exceeds half of an 8px bar and squares the ends off. */}
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="num w-8 shrink-0 text-right text-xs font-semibold">
        {formatNum(row.n)}
      </span>
      {row.sub && (
        <span className="num w-9 shrink-0 text-right text-[0.68rem] text-ink-3">
          {row.sub}
        </span>
      )}
    </>
  );

  return (
    <li className="flex items-center gap-2">
      {row.href ? (
        <Link href={row.href} className="flex min-w-0 flex-1 items-center gap-2">
          {label}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">{label}</div>
      )}

      {/* READ-ONLY since 2026-08-29. A sales agent used to set their own target
          here, which made it a self-assessment rather than a target. The
          manager sets it on ผลงานตามกระบวนการขาย (the team dashboard); this
          shows what you are measured on and whether you are past it. */}
      {showTargets && hasTarget && (
        <span
          title={`เป้า ${formatNum(row.target!)} ในช่วงนี้ — ผู้จัดการเป็นผู้ตั้ง`}
          className={`num shrink-0 rounded-full px-1.5 py-0.5 text-[0.68rem] ${
            hit ? "bg-good-soft text-good" : "bg-surface-3 text-ink-3"
          }`}
        >
          /{formatNum(row.target!)}
        </span>
      )}
    </li>
  );
}
