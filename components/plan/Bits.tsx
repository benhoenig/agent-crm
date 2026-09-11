"use client";

/* Small planner primitives — the ring, the ratio bar, the streak tiles and
   the celebration. Ported from Solo Gang's RingProgress / TaskRatioBar /
   MomentumCard / Celebration, restyled onto Habihub's semantic tokens (no
   hex anywhere, per the rule at the top of globals.css). */

import { useEffect, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { taskToneVar, type TaskType } from "@/lib/plan";
import type { Celebration as CelebrationEvent, PlanTask } from "@/lib/plan";

/* ---------- ring ---------------------------------------------------------- */

export function RingProgress({ pct, size = 64, stroke = 7 }: { pct: number; size?: number; stroke?: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const met = p >= 100;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={met ? "var(--good)" : "var(--accent)"} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - p / 100)}
          style={{ transition: "stroke-dashoffset 500ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className={`num text-[0.9rem] font-bold ${met ? "text-good" : "text-ink"}`}>{p}%</span>
      </div>
    </div>
  );
}

/* ---------- task ratio ---------------------------------------------------- */

/** The awareness visual: how today splits across Cream's task categories.

    The FIRST category in her Settings order is the one the headline percentage
    quotes — by seed that is สร้าง, and the whole question this bar answers is
    "did today move the business, or only keep it running?". If she reorders
    the list, the headline follows her order rather than a hardcoded key, which
    is the same rule every other options-driven surface follows. */
export function TaskRatioBar({ tasks, types }: { tasks: PlanTask[]; types: TaskType[] }) {
  const total = tasks.length;
  if (!total || !types.length) return null;

  // Anything on a retired or unset category lands in a trailing "อื่นๆ" slice
  // rather than vanishing — the widths have to add up to the task count.
  const counted = types.map((t) => ({ opt: t, n: tasks.filter((x) => x.kind === t.key).length }));
  const known = counted.reduce((s, c) => s + c.n, 0);
  const other = total - known;
  const lead = counted[0];

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[0.75rem] text-ink-2">สัดส่วนงานวันนี้</span>
        <span className="text-[0.75rem] text-ink-2">
          <span className="num font-bold text-accent-text">{Math.round((lead.n / total) * 100)}%</span> {lead.opt.key}
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
        {counted.filter((c) => c.n > 0).map((c) => (
          <div
            key={c.opt.key}
            title={`${c.opt.key} · ${c.n}`}
            style={{ width: `${(c.n / total) * 100}%`, background: taskToneVar(c.opt.tone), transition: "width 400ms ease" }}
          />
        ))}
        {other > 0 && <div title={`อื่นๆ · ${other}`} style={{ width: `${(other / total) * 100}%`, background: "var(--ink-3)" }} />}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem]">
        {counted.map((c) => (
          <span key={c.opt.key} className="flex items-center gap-1.5 text-ink-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: taskToneVar(c.opt.tone) }} />
            {c.opt.key} <span className="num font-semibold text-ink">{c.n}</span>
          </span>
        ))}
        {other > 0 && (
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-ink-3" />
            อื่นๆ <span className="num font-semibold text-ink">{other}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- celebration --------------------------------------------------- */

const CONFETTI = ["var(--accent)", "var(--warn)", "var(--info)", "var(--chart-4)", "var(--good)"];

/** One-shot confetti + toast, fired by the parent when the day hits 100%.
    Driven by a fresh `event` object so it can never fire on load. */
export function Celebration({ event, onDone }: { event: CelebrationEvent | null; onDone: () => void }) {
  useEffect(() => {
    if (!event) return;
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [event, onDone]);

  // Randomised once per event. Recomputing on every render would re-roll the
  // pieces mid-fall and the animation would visibly stutter.
  const pieces = useMemo(() => {
    if (!event) return [];
    return Array.from({ length: 40 }, (_, i) => ({
      left: Math.random() * 100,
      bg: CONFETTI[i % CONFETTI.length],
      delay: Math.random() * 0.45,
      dur: 1.7 + Math.random() * 1.3,
      size: 6 + Math.random() * 6,
      round: Math.random() > 0.5,
    }));
  }, [event]);

  if (!event) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-0"
          style={{
            left: `${p.left}%`, width: p.size, height: p.size, background: p.bg,
            borderRadius: p.round ? "50%" : 2,
            animation: `confetti-fall ${p.dur}s ${p.delay}s cubic-bezier(.25,.6,.4,1) forwards`,
          }}
        />
      ))}
      <div
        role="status"
        className="fixed left-1/2 top-[16%] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-full bg-surface px-5 py-3.5 border border-line-strong shadow-xl"
        style={{
          border: `1px solid ${event.tone === "gold" ? "var(--warn)" : "var(--accent)"}`,
          animation: "celebrate-pop 2.8s ease forwards",
        }}
      >
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[1.1rem] ${event.tone === "gold" ? "bg-warn-soft" : "bg-accent-soft"}`}>
          {event.emoji}
        </div>
        <div className="min-w-0">
          <div className="whitespace-nowrap text-[0.9rem] font-bold text-ink">{event.title}</div>
          <div className="text-[0.72rem] text-ink-2">{event.sub}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- carry-forward banner ------------------------------------------ */

/** Yesterday's "one thing I'll try tomorrow", surfaced on top of today's plan
    with a one-tap add. This is the only part of the recap that feeds back into
    the plan, and it is the reason the recap is worth writing at all. */
export function CarryBanner({ text, onAdd }: { text: string; onAdd: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-accent-soft px-3 py-2.5">
      <Sparkles size={15} className="shrink-0 text-accent-text" />
      <div className="min-w-0 flex-1">
        <div className="text-[0.68rem] text-ink-2">เมื่อวานตั้งใจจะลอง</div>
        <div className="truncate text-[0.85rem] font-semibold text-ink">{text}</div>
      </div>
      <button
        onClick={onAdd}
        className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[0.72rem] font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
      >
        + เพิ่มเป็นงาน
      </button>
    </div>
  );
}


/* ---------- card frame ---------------------------------------------------- */

/** The planner's card frame — Habihub's Card is unpadded (CardHeader +
    px-5 sections); the ported planner lays itself out inside a padded box. */
import { Card } from "@/components/ui";

export function PlanCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <Card className={`p-5 ${className ?? ""}`}>{children}</Card>;
}

export function PlanCardTitle({ children, action, className }: {
  children: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-3 ${className ?? ""}`}>
      <h2 className="text-sm font-semibold">{children}</h2>
      {action}
    </div>
  );
}
