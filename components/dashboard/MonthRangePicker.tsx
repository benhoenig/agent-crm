"use client";

/* ช่วงเวลา — the filter every card on ภาพรวมทีม reads.

   Ported from the Habihub Sales Dashboard's MonthRangePicker (Ben,
   2026-08-28), where the same control drives the whole Overview tab.

   THE RANGE LIVES IN THE URL, not in component state or localStorage, and
   that is the one structural change from the source. Everything downstream is
   a server aggregate, so a client-held range would mean a fetch action per
   card and a loading state per card; as a search param the page simply
   re-renders with the right numbers already in it, `?tab=deals` keeps
   working alongside it, and a manager can send someone the exact view they
   are looking at. The reading preferences that stay local (the trend metric,
   the heatmap's category) are the ones that change nothing on the server.

   The preset row wraps rather than scrolls: a flex row with hidden overflow
   collapses to a zero min-width, which on tablet pushed ปีนี้ off the right
   edge in the source — the same bug is called out in its own comments. */

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Select } from "@/components/ui";
import {
  availableMonths,
  monthLabel,
  monthPresets,
  type MonthRange,
} from "@/lib/month-range";

export function MonthRangePicker({
  range,
  today,
}: {
  range: MonthRange;
  /** Asia/Bangkok today, from the server — the browser's midnight must not
      decide which month "เดือนนี้" is. */
  today: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const presets = monthPresets(today);
  const months = availableMonths(today);
  const active = presets.find(
    (p) => p.from === range.from && p.to === range.to
  )?.id;

  function go(next: MonthRange) {
    const qs = new URLSearchParams(params.toString());
    qs.set("from", next.from);
    qs.set("to", next.to);
    start(() => router.push(`/?${qs.toString()}`, { scroll: false }));
  }

  // Picking a start after the current end collapses the range onto it rather
  // than producing an empty one — an inverted range reads as "no data" when
  // what happened was a mis-click.
  const setFrom = (from: string) =>
    go({ from, to: from > range.to ? from : range.to });
  const setTo = (to: string) =>
    go({ to, from: to < range.from ? to : range.from });

  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-2 ${
        pending ? "opacity-60" : ""
      }`}
    >
      {pending && (
        <LoaderCircle size={14} className="animate-spin text-ink-3" />
      )}
      <div className="flex flex-wrap items-center gap-1 rounded-full bg-surface-3 p-0.5">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => go(p)}
            aria-pressed={p.id === active}
            disabled={pending}
            className={`rounded-full px-2.5 py-1 text-[0.72rem] font-medium transition-colors disabled:pointer-events-none ${
              p.id === active
                ? "bg-surface text-ink shadow-card"
                : "text-ink-3 hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Select
          value={range.from}
          onChange={(e) => setFrom(e.target.value)}
          disabled={pending}
          aria-label="เดือนเริ่มต้น"
          className="w-auto px-2 py-1 text-xs"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
        <span className="text-xs text-ink-3">→</span>
        <Select
          value={range.to}
          onChange={(e) => setTo(e.target.value)}
          disabled={pending}
          aria-label="เดือนสิ้นสุด"
          className="w-auto px-2 py-1 text-xs"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
