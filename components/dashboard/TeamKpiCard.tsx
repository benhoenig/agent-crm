"use client";

/* ผลงานตามกระบวนการขาย — every agent against their own acquisition target.

   Ported from the Habihub Sales Dashboard's KPITracker (Ben, 2026-08-28).
   One column per acquisition activity, agents inside it ranked by how far
   through their own target they are. Ranking by PERCENTAGE rather than by
   count is the whole idea: it puts the person with the smaller target and the
   better week at the top, which a raw count never would.

   THE COLUMNS COME FROM `options.scope = 'owner'` (migration 0018), not from
   a list in code — see lib/repo/team-overview.ts getTeamKpi for why the
   buyer side is deliberately absent.

   A ROW WITH NO TARGET STILL SHOWS ITS COUNT, with no bar. The source renders
   "3/0" and a full-width bar in that case, which reads as an achievement. An
   unset target is silence, not a target of zero — the same distinction
   ความเคลื่อนไหว draws.

   THIS IS WHERE KPI TARGETS ARE SET (Ben, 2026-08-29), for whoever holds
   `targetsSet` — the manager. It used to be the sales agent's own card, which
   made the number a self-assessment; setting it here puts the decision next to
   the comparison it is for, with every agent's figure visible at once. The
   sales dashboard still shows each person their own target, read-only. */

import { useState, useTransition } from "react";
import { Check, LoaderCircle, Pencil, Target, X } from "lucide-react";
import { Card, CardHeader, EmptyState, Input } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { formatNum } from "@/lib/format";
import { kindMetric } from "@/lib/targets";
import { setAgentKpiTarget } from "@/app/(app)/overview-actions";
import type { TeamKpi, TeamMember } from "@/lib/repo/team-overview";

export function TeamKpiCard({
  kpi,
  team,
  label,
  canSet = false,
  months,
}: {
  kpi: TeamKpi;
  team: TeamMember[];
  label: string;
  /** viewer.perms.targetsSet — the manager. */
  canSet?: boolean;
  /** Months in the selected range. The stored figure is MONTHLY, so a
      multi-month view shows target × months and the editor must divide back
      out — otherwise saving an untouched field would silently triple it. */
  months: number;
}) {
  /* AN EXPLICIT MODE, not always-on click targets (Ben, 2026-08-29). Every
     number here was already clickable for a manager, but nothing said so —
     the same complaint as the hero's bare 🎯 icon. A labelled button turns
     editing on, and only then do the targets look like controls. It also
     keeps the default reading view clean, which is what this card is for
     ninety-nine times out of a hundred. */
  const [editMode, setEditMode] = useState(false);

  return (
    <Card>
      <CardHeader
        title="ผลงานตามกระบวนการขาย"
        action={
          canSet && (
            <button
              type="button"
              onClick={() => setEditMode((e) => !e)}
              aria-pressed={editMode}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-ctl px-3 py-1.5 text-[0.78rem] font-semibold transition-colors ${
                editMode
                  ? "bg-surface-3 text-ink hover:bg-line"
                  : "bg-accent text-accent-ink hover:bg-accent-hover"
              }`}
            >
              <Target size={14} />
              {editMode ? "ปิด" : "ตั้งเป้า"}
            </button>
          )
        }
      />
      <p className="px-5 pb-3 text-[0.72rem] text-ink-3">
        งานฝั่งเจ้าของ · นับสะสมทั้งช่วง · เทียบเป้าของแต่ละคน · {label}
        {editMode && " · กดที่ตัวเลขเพื่อตั้งเป้ารายเดือน"}
      </p>

      {kpi.categories.length === 0 || team.length === 0 ? (
        <EmptyState
          title="ยังไม่มีกิจกรรมฝั่งเจ้าของที่ตั้งค่าไว้"
          hint="กำหนดได้ที่ ตั้งค่า → ตัวเลือก → ประเภทกิจกรรม"
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
          {kpi.categories.map((category) => (
            <KpiColumn
              key={category}
              category={category}
              team={team}
              counts={kpi.counts[category] ?? {}}
              targets={kpi.targets[category] ?? {}}
              canSet={editMode}
              months={months}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function KpiColumn({
  category,
  team,
  counts,
  targets,
  canSet,
  months,
}: {
  category: string;
  team: TeamMember[];
  counts: Record<string, number>;
  targets: Record<string, number>;
  canSet: boolean;
  months: number;
}) {
  const rows = team
    .map((m) => {
      const done = counts[m.id] ?? 0;
      const target = targets[m.id] ?? null;
      return {
        ...m,
        done,
        target,
        pct: target && target > 0 ? Math.min(100, (done / target) * 100) : 0,
      };
    })
    // Percentage first, then raw count — so agents with no target at all sort
    // among themselves by work done rather than alphabetically.
    .sort((a, b) => b.pct - a.pct || b.done - a.done);

  // One column's target, when the team shares one. Agents on different
  // numbers get theirs on their own row instead; a single figure at the top
  // would be a lie about four of them.
  const set = new Set(rows.map((r) => r.target).filter((t) => t !== null));
  const common = set.size === 1 ? [...set][0]! : null;

  return (
    <div>
      <div className="pb-2">
        <div className="text-[0.78rem] font-semibold">{category}</div>
        <div className="num text-[0.66rem] tracking-wide text-ink-3">
          {common !== null ? `เป้า ${formatNum(common)}` : "เป้าต่างกันรายคน"}
        </div>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <KpiRow
            key={r.id}
            row={r}
            leader={i === 0}
            metric={kindMetric(category)}
            canSet={canSet}
            months={months}
          />
        ))}
      </ul>
    </div>
  );
}


/** One agent's line in a KPI column. The target is a button for a manager and
    plain text for everyone else — and the number typed is the MONTHLY figure,
    which is the one stored, never the range-scaled one shown beside the
    count. Keeping those apart is what stops a three-month view saving a
    target three times too big. */
function KpiRow({
  row,
  leader,
  metric,
  canSet,
  months,
}: {
  row: TeamMember & { done: number; target: number | null; pct: number };
  leader: boolean;
  metric: string;
  canSet: boolean;
  months: number;
}) {
  const monthly =
    row.target === null ? null : Math.round(row.target / Math.max(months, 1));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(monthly ?? ""));
  const [pending, start] = useTransition();
  const hit = row.target !== null && row.done >= row.target;

  function save() {
    const raw = draft.trim();
    start(async () => {
      await setAgentKpiTarget(row.id, metric, raw === "" ? null : Number(raw));
      setEditing(false);
    });
  }

  return (
    <li className={`flex items-center gap-1.5 ${pending ? "opacity-50" : ""}`}>
      <Avatar image={row.image} name={row.name} size="size-5 text-[0.55rem]" />
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[0.68rem] ${
            leader && row.done > 0 ? "font-semibold text-ink" : "text-ink-2"
          }`}
        >
          {row.name}
        </div>
        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
          {row.target !== null && (
            <div
              className={`h-full rounded-full ${hit ? "bg-good" : "bg-accent"}`}
              style={{ width: `${row.pct}%` }}
            />
          )}
        </div>
      </div>

      {editing ? (
        <span className="flex shrink-0 items-center gap-0.5">
          <Input
            autoFocus
            type="number"
            min={0}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-6 w-12 px-1 py-0 text-[0.66rem]"
            aria-label={`เป้ารายเดือนของ ${row.name}`}
          />
          <button
            type="button"
            onClick={save}
            aria-label="บันทึก"
            className="grid size-5 place-items-center rounded text-good hover:bg-good-soft"
          >
            {pending ? (
              <LoaderCircle size={11} className="animate-spin" />
            ) : (
              <Check size={11} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label="ยกเลิก"
            className="grid size-5 place-items-center rounded text-ink-3 hover:bg-surface-3"
          >
            <X size={11} />
          </button>
        </span>
      ) : canSet ? (
        <button
          type="button"
          onClick={() => {
            setDraft(String(monthly ?? ""));
            setEditing(true);
          }}
          title={
            monthly === null
              ? "ตั้งเป้ารายเดือน"
              : `เป้า ${formatNum(monthly)} ต่อเดือน — แก้ไข`
          }
          className={`num flex shrink-0 items-center gap-0.5 rounded border border-dashed border-line-strong px-1 text-[0.66rem] transition-colors hover:border-accent hover:bg-surface-3 hover:text-ink ${
            hit ? "font-semibold text-good" : "text-ink-3"
          }`}
        >
          {row.target === null ? (
            <>
              {formatNum(row.done)} <Pencil size={9} />
            </>
          ) : (
            `${formatNum(row.done)}/${formatNum(row.target)}`
          )}
        </button>
      ) : (
        <span
          className={`num shrink-0 text-[0.66rem] ${
            hit ? "font-semibold text-good" : "text-ink-3"
          }`}
        >
          {row.target === null
            ? formatNum(row.done)
            : `${formatNum(row.done)}/${formatNum(row.target)}`}
        </span>
      )}
    </li>
  );
}
