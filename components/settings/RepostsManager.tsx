"use client";

// Repost cadence editor (Settings → รอบดันประกาศ).
//
// A matrix, not a list. Every channel gets a line per grade — including pairs
// with NO rule, which the old form could not distinguish from "0 listings".
// It matters: lib/repo/reposts.ts INNER JOINs repost_rules, so a pair without
// a rule never enters the ดันประกาศ queue and nothing anywhere says so.
//
// The second thing the old form hid is the WORKLOAD. A cadence is not just
// "how often" — listings ÷ days is how many ดันแล้ว ticks a day the team is
// being asked for, every day, forever. 708 listings on a 7-day cycle is ~101
// pushes a day. That number belongs next to the field you type it in.
//
// Same interaction as the other settings tabs: type, blur, "บันทึกแล้ว ✓".
// Clearing the field removes the rule; 0 would mean "due again the same day".

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import { Input, Pill, type Tone } from "@/components/ui";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { formatNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { RepostCell, RepostMatrix } from "@/lib/repo/reposts";
import {
  deleteRepostRule,
  setRepostDays,
} from "@/app/(app)/settings/reposts/actions";

const cellKey = (c: RepostCell) => `${c.grade}|${c.channel}`;

/** ดันแล้ว ticks per day this cadence implies, in steady state. Kept coarse
    on purpose — it is a workload sanity check, not an SLA. */
function perDay(listings: number, days: number | null): number | null {
  if (!days || listings === 0) return null;
  return listings / days;
}

function loadText(n: number): string {
  return n >= 10 ? formatNum(Math.round(n)) : n.toFixed(1);
}

export function RepostsManager({ matrix }: { matrix: RepostMatrix }) {
  const [savedKey, setSavedKey] = React.useState<string | null>(null);
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = React.useState<{ key: string; msg: string } | null>(
    null
  );
  const [, startTransition] = React.useTransition();

  function flashSaved(key: string) {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedKey(key);
    savedTimer.current = setTimeout(() => setSavedKey(null), 1600);
  }

  function save(cell: RepostCell, days: number | null) {
    setError(null);
    const key = cellKey(cell);
    startTransition(async () => {
      const res = await setRepostDays(cell.grade, cell.channel, days);
      if (res.ok) flashSaved(key);
      else setError({ key, msg: res.error });
    });
  }

  function removeOrphan(id: number) {
    startTransition(async () => {
      await deleteRepostRule(id);
    });
  }

  const totalPerDay = matrix.cells.reduce(
    (n, c) => n + (perDay(c.listings, c.days) ?? 0),
    0
  );
  const totalDue = matrix.cells.reduce((n, c) => n + c.due, 0);
  // "no cadence anywhere" is about rules, not about load: a rule on a channel
  // nobody has posted to yet is still a rule.
  const anyRule = matrix.cells.some((c) => c.days !== null);

  return (
    <div className="divide-y divide-line">
      {matrix.channels.map((ch) => {
        const cells = matrix.cells.filter((c) => c.channel === ch.key);
        const unset = cells.filter((c) => c.days === null && c.listings > 0);
        const load = cells.reduce(
          (n, c) => n + (perDay(c.listings, c.days) ?? 0),
          0
        );

        return (
          <section key={ch.key} className="px-5 py-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className="text-sm font-semibold">{ch.key}</h3>
              {ch.hidden ? (
                <span
                  className="text-xs text-ink-3"
                  title="ช่องทางนี้ถูกซ่อนในรายการตัวเลือก แต่ยังมีข้อมูลค้างอยู่"
                >
                  (ซ่อนอยู่)
                </span>
              ) : null}
              <span className="text-xs text-ink-3">
                ทรัพย์ {formatNum(ch.listings)} รายการ
                {load > 0 ? ` · ต้องดันราว ${loadText(load)} ครั้ง/วัน` : ""}
              </span>
            </div>

            {ch.listings === 0 ? (
              <p className="pt-1.5 text-xs text-ink-3">
                ยังไม่มีทรัพย์ที่โพสต์อยู่บนช่องทางนี้ — ตั้งรอบไว้ได้ แต่จะยังไม่มีอะไรเข้าคิว
              </p>
            ) : null}

            <ul className="pt-2.5">
              {cells.map((c) => (
                <RepostRow
                  key={cellKey(c)}
                  cell={c}
                  saved={savedKey === cellKey(c)}
                  error={error?.key === cellKey(c) ? error.msg : null}
                  save={save}
                />
              ))}
              {cells.length === 0 ? (
                <li className="py-1 text-xs text-ink-3">
                  ยังไม่มีเกรดประกาศ —{" "}
                  <Link
                    href="/settings/options?kind=listing_potential"
                    className="text-accent-text hover:underline"
                  >
                    เพิ่มที่รายการตัวเลือก
                  </Link>
                </li>
              ) : null}
            </ul>

            {unset.length > 0 ? (
              <p className="flex items-start gap-1.5 pt-2 text-xs text-warn">
                <AlertTriangle size={13} className="mt-px shrink-0" />
                <span>
                  {unset.map((c) => `“${c.grade}”`).join(" ")} ยังไม่ตั้งรอบ — ทรัพย์{" "}
                  {formatNum(unset.reduce((n, c) => n + c.listings, 0))} รายการ
                  บนช่องทางนี้จะไม่เข้าคิวดันประกาศเลย
                </span>
              </p>
            ) : null}
          </section>
        );
      })}

      {matrix.orphans.length > 0 ? (
        <section className="px-5 py-4">
          <p className="text-xs font-medium text-warn">
            รอบที่ไม่มีเกรด/ช่องทางรองรับแล้ว — ไม่มีผลกับทรัพย์ใด
            และกันไม่ให้ตั้งชื่อซ้ำกับชื่อนี้
          </p>
          <ul className="pt-1.5">
            {matrix.orphans.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-1 text-xs">
                <span className="font-medium">
                  {o.gradeKey} × {o.channelKey}
                </span>
                <span className="num text-ink-3">ทุก {o.days} วัน</span>
                <span className="flex-1" />
                <ConfirmDelete
                  onConfirm={() => removeOrphan(o.id)}
                  confirmLabel={`ลบรอบของ “${o.gradeKey} × ${o.channelKey}”?`}
                  actionLabel="ลบรอบ"
                  triggerAriaLabel={`ลบรอบ ${o.gradeKey} ${o.channelKey}`}
                  warning={
                    o.missing === "grade"
                      ? "ไม่มีเกรดนี้ในระบบแล้ว รอบนี้จึงไม่เคยถูกใช้งาน"
                      : o.missing === "channel"
                        ? "ไม่มีช่องทางนี้ในระบบแล้ว รอบนี้จึงไม่เคยถูกใช้งาน"
                        : "ไม่มีทั้งเกรดและช่องทางนี้ในระบบแล้ว"
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-xs text-ink-3">
        <span>
          รวมทุกช่องทาง:{" "}
          {!anyRule ? (
            <span className="text-warn">ยังไม่ได้ตั้งรอบเลย — คิวดันประกาศจะว่างตลอด</span>
          ) : totalPerDay > 0 ? (
            <span className="num font-medium text-ink">
              ราว {loadText(totalPerDay)} ครั้ง/วัน
            </span>
          ) : (
            <span>ตั้งรอบไว้แล้ว แต่ยังไม่มีทรัพย์บนช่องทางที่ตั้งไว้</span>
          )}
        </span>
        {totalDue > 0 ? (
          <span>
            ถึงรอบแล้วตอนนี้{" "}
            <Link href="/reposts" className="text-accent-text hover:underline">
              <span className="num">{formatNum(totalDue)}</span> รายการ
            </Link>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RepostRow({
  cell,
  saved,
  error,
  save,
}: {
  cell: RepostCell;
  saved: boolean;
  error: string | null;
  save: (cell: RepostCell, days: number | null) => void;
}) {
  // Uncontrolled and keyed by identity only — deliberately NOT by the saved
  // value. Keying on the value remounts the field when the round-trip lands,
  // which silently throws away whatever was typed in the meantime.
  function commit(el: HTMLInputElement) {
    const raw = el.value.trim();
    const next = raw === "" ? null : Number(raw);
    if (next === cell.days) return;
    // Junk goes to the action too — it owns the rules and returns the Thai
    // message, so the client never has a second copy of them to drift from.
    save(cell, next !== null && Number.isNaN(next) ? -1 : next);
  }

  const load = perDay(cell.listings, cell.days);

  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="w-28 shrink-0">
        <Pill tone={(cell.tone as Tone) ?? "muted"}>{cell.grade}</Pill>
      </span>

      {cell.gradeHidden ? (
        <span
          className="shrink-0 text-xs text-ink-3"
          title="เกรดนี้ถูกซ่อนในรายการตัวเลือก"
        >
          ซ่อนอยู่
        </span>
      ) : null}

      <span className="shrink-0 text-xs text-ink-3">ทุก</span>
      {/* fixed-width box — Input's base w-full fills it (cn() has no
          tailwind-merge, so a w-24 className would not override w-full) */}
      <div className="w-24 shrink-0">
        <Input
          type="number"
          min={1}
          max={365}
          inputMode="numeric"
          key={cellKey(cell)}
          defaultValue={cell.days ?? ""}
          placeholder="ไม่ตั้ง"
          aria-label={`รอบดัน (วัน) สำหรับเกรด ${cell.grade} บน ${cell.channel}`}
          className="num text-right"
          onBlur={(e) => commit(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </div>
      <span className="shrink-0 text-xs text-ink-3">วัน</span>

      <span className="min-w-0 flex-1 truncate text-xs text-ink-3">
        {cell.listings > 0 ? (
          <>
            ทรัพย์ {formatNum(cell.listings)} รายการ
            {cell.days === null ? (
              <span className="text-warn"> · ไม่เข้าคิวดัน</span>
            ) : (
              <>
                <span> · ราว {loadText(load ?? 0)} ครั้ง/วัน</span>
                {cell.due > 0 ? (
                  <span className={cn("text-warn")}>
                    {" "}
                    · ถึงรอบแล้ว {formatNum(cell.due)}
                  </span>
                ) : null}
              </>
            )}
          </>
        ) : (
          <span>ยังไม่มีทรัพย์เกรดนี้บนช่องทางนี้</span>
        )}
      </span>

      {error ? (
        <span className="shrink-0 text-xs text-bad">{error}</span>
      ) : saved ? (
        <span className="flex shrink-0 items-center gap-1 text-xs text-good">
          <Check size={12} /> บันทึกแล้ว
        </span>
      ) : null}
    </li>
  );
}
