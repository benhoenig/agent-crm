"use client";

// SLA editor (Settings → SLA ติดตามงาน).
//
// A matrix, not a list. Each of the three clocks gets a row per grade it
// could apply to — including grades with NO rule, which is the state the old
// table could not show. That matters: every overdue query INNER JOINs
// sla_rules, so a grade without a rule is never late and nothing anywhere
// says so. Here it reads "ไม่ตั้ง" next to the number of rows it silently
// exempts.
//
// Same interaction as the other settings tabs: type, blur, "บันทึกแล้ว ✓".
// Clearing the field removes the rule (that is how "New Lead" has always
// worked) — 0 would mean "late on day one", which is a different thing.

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import { Input, Pill, type Tone } from "@/components/ui";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { formatNum } from "@/lib/format";
import { SLA_ENTITIES } from "@/lib/sla";
import { cn } from "@/lib/cn";
import { deleteSlaRule, setSlaDays } from "@/app/(app)/settings/sla/actions";

export interface SlaRowItem {
  entity: string;
  potential: string;
  status: "active" | "hidden" | "orphan";
  tone: string | null;
  ruleId: string | null;
  maxDays: number | null;
  tracked: number;
  overdue: number;
}

const rowKey = (r: SlaRowItem) => `${r.entity}::${r.potential}`;

export function SlaManager({ rows }: { rows: SlaRowItem[] }) {
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

  function save(row: SlaRowItem, days: number | null) {
    setError(null);
    const key = rowKey(row);
    startTransition(async () => {
      const res = await setSlaDays(row.entity, row.potential, days);
      if (res.ok) flashSaved(key);
      else setError({ key, msg: res.error });
    });
  }

  function removeOrphan(row: SlaRowItem) {
    if (!row.ruleId) return;
    startTransition(async () => {
      await deleteSlaRule(row.ruleId!);
    });
  }

  return (
    <div className="divide-y divide-line">
      {SLA_ENTITIES.map((def) => {
        const group = rows.filter((r) => r.entity === def.entity);
        const grades = group.filter((r) => r.status !== "orphan");
        const orphans = group.filter((r) => r.status === "orphan");
        const unset = grades.filter((r) => r.maxDays === null && r.tracked > 0);

        return (
          <section key={def.entity} className="px-5 py-4">
            <h3 className="text-sm font-semibold">{def.title}</h3>
            <p className="pt-0.5 text-xs leading-relaxed text-ink-3">
              {def.counts} · ดูเฉพาะ{def.scope}
            </p>

            <ul className="pt-2.5">
              {grades.map((r) => (
                <SlaRow
                  key={rowKey(r)}
                  row={r}
                  noun={def.noun}
                  saved={savedKey === rowKey(r)}
                  error={error?.key === rowKey(r) ? error.msg : null}
                  save={save}
                />
              ))}
              {grades.length === 0 ? (
                <li className="py-3 text-xs text-ink-3">
                  ยังไม่มีเกรดในรายการนี้ —{" "}
                  <Link
                    href={`/settings/options?kind=${def.kind}`}
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
                  {unset.map((r) => `“${r.potential}”`).join(" ")} ยังไม่ตั้งกี่วัน
                  — {def.noun}
                  {formatNum(unset.reduce((n, r) => n + r.tracked, 0))} รายการในเกรดนี้
                  จะไม่ขึ้นป้าย “ค้าง” เลย
                </span>
              </p>
            ) : null}

            {orphans.length > 0 ? (
              <div className="mt-3 rounded-ctl bg-warn-soft/40 px-3 py-2">
                <p className="text-xs font-medium text-warn">
                  กฎที่ไม่มีเกรดรองรับแล้ว — ไม่มีผลกับใคร และกันไม่ให้ตั้งชื่อเกรดซ้ำ
                </p>
                <ul className="pt-1.5">
                  {orphans.map((r) => (
                    <li
                      key={rowKey(r)}
                      className="flex items-center gap-3 py-1 text-xs"
                    >
                      <span className="font-medium">{r.potential}</span>
                      <span className="num text-ink-3">{r.maxDays} วัน</span>
                      <span className="flex-1" />
                      <ConfirmDelete
                        onConfirm={() => removeOrphan(r)}
                        confirmLabel={`ลบกฎของ “${r.potential}”?`}
                        actionLabel="ลบกฎ"
                        triggerAriaLabel={`ลบกฎ ${r.potential}`}
                        warning="ไม่มีเกรดนี้ในระบบแล้ว กฎนี้จึงไม่เคยถูกใช้งาน"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function SlaRow({
  row,
  noun,
  saved,
  error,
  save,
}: {
  row: SlaRowItem;
  noun: string;
  saved: boolean;
  error: string | null;
  save: (row: SlaRowItem, days: number | null) => void;
}) {
  // Uncontrolled and keyed by identity only — deliberately NOT by the saved
  // value. Keying on the value remounts the field when the round-trip lands,
  // which silently throws away whatever was typed in the meantime (seconds,
  // on a slow connection). The field keeps what the user typed; `commit`
  // compares against the server value to decide whether to write.
  function commit(el: HTMLInputElement) {
    const raw = el.value.trim();
    const next = raw === "" ? null : Number(raw);
    if (next === row.maxDays) return;
    // Junk goes to the action too — it owns the rules and returns the Thai
    // message, so the client never has a second copy of them to drift from.
    save(row, next !== null && Number.isNaN(next) ? -1 : next);
  }

  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="w-28 shrink-0">
        <Pill tone={(row.tone as Tone) ?? "muted"}>{row.potential}</Pill>
      </span>

      {row.status === "hidden" ? (
        <span className="shrink-0 text-xs text-ink-3" title="เกรดนี้ถูกซ่อนในรายการตัวเลือก">
          ซ่อนอยู่
        </span>
      ) : null}

      {/* fixed-width box — Input's base w-full fills it (cn() has no
          tailwind-merge, so a w-24 className would not override w-full) */}
      <div className="w-24 shrink-0">
        <Input
          type="number"
          min={1}
          max={365}
          inputMode="numeric"
          key={rowKey(row)}
          defaultValue={row.maxDays ?? ""}
          placeholder="ไม่ตั้ง"
          aria-label={`เกิน (วัน) สำหรับเกรด ${row.potential}`}
          className="num text-right"
          onBlur={(e) => commit(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </div>
      <span className="shrink-0 text-xs text-ink-3">วัน</span>

      <span className="min-w-0 flex-1 truncate text-xs text-ink-3">
        {row.tracked > 0 ? (
          <>
            {noun} {formatNum(row.tracked)} รายการ
            {row.maxDays === null ? (
              <span className="text-warn"> · ไม่มีป้ายค้าง</span>
            ) : (
              <span className={cn(row.overdue > 0 && "text-bad")}>
                {" "}
                · ค้างอยู่ {formatNum(row.overdue)}
              </span>
            )}
          </>
        ) : (
          <span>ยังไม่มี{noun}ในเกรดนี้</span>
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
