"use client";

/* The /leads column registry — what a lead looks like as a grid row.

   Same bargain as ListingsGrid: every field gets a column, the reader hides
   what they do not want, and the layout is saved per account (lib/tables).
   The columns nobody used to see — เบอร์, ติดต่อผ่าน, ประเภทลีด, รหัสเดิม —
   are here because a grid can afford them and a list could not.

   STAGE AND STATUS ARE FILLS, not pills. On a lead list those two ARE the
   scan: "who is at Nego" and "what is still open" are answered by the shape
   of a tinted column, not by reading twenty chips in sequence.

   The pipeline stage borrows PIPELINE_STAGE_TONE, which is a workflow enum in
   code rather than an options row — the one tone map here that Settings does
   not own (see lib/labels.ts on why the workflow enums kept theirs). */

import { SheetTable, Dim, Val } from "@/components/ui/SheetTable";
import type { Tone } from "@/components/ui";
import type { SheetColumn, TablePrefs } from "@/lib/tables";
import { PIPELINE_STAGES, PIPELINE_STAGE_TONE, toneFor } from "@/lib/labels";
import { daysAgoLabel, formatDate, formatNum } from "@/lib/format";

export interface LeadRow {
  id: string;
  legacyCode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  interest: string | null;
  leadType: string | null;
  source: string | null;
  contactBy: string | null;
  potential: string | null;
  pipelineStage: string;
  leadStatus: string;
  budgetMillion: string | null;
  assignedName: string | null;
  createdDate: string | null;
  /** last follow → created day, resolved on the server. */
  followRef: string | null;
  /** Days past the follow-up SLA, or null when inside it. */
  overdueDays: number | null;
}

/* Sort keys are the column's MEANING, not its text — งบ reads "12.5 ลบ." and
   sorts as a number, Follow sorts by how overdue rather than by date. See
   ListingsGrid for the same note at length.

   STAGE SORTS BY POSITION IN THE PIPELINE, not alphabetically. "Nego" before
   "Present" is an alphabet's opinion about a process that has an order of its
   own, and PIPELINE_STAGES is that order. */
const num = (v: string | number | null) =>
  v === null || v === "" ? null : Number(v);

export function LeadsGrid({
  rows,
  prefs,
  tones,
  caption,
  empty,
}: {
  rows: LeadRow[];
  prefs?: TablePrefs;
  tones: { status: Record<string, Tone>; potential: Record<string, Tone> };
  caption: string;
  empty: string;
}) {
  const columns: SheetColumn<LeadRow>[] = [
    {
      key: "name",
      label: "ลูกค้า",
      sort: (l: LeadRow) => l.contactName,
      locked: true,
      width: 190,
      cell: (l) => (
        <span className="flex items-baseline gap-2">
          <span className="truncate">{l.contactName ?? "(ไม่มีชื่อ)"}</span>
          {l.contactPhone && (
            <span className="num shrink-0 text-[0.68rem] text-ink-3">
              {l.contactPhone}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "stage",
      label: "Stage",
      sort: (l: LeadRow) => {
        const i = PIPELINE_STAGES.indexOf(l.pipelineStage as never);
        return i < 0 ? null : i;
      },
      width: 90,
      cell: (l) => <Val>{l.pipelineStage}</Val>,
      fill: (l) => ({ tone: toneFor(PIPELINE_STAGE_TONE, l.pipelineStage) }),
    },
    {
      key: "status",
      label: "สถานะ",
      sort: (l: LeadRow) => l.leadStatus,
      width: 100,
      cell: (l) => <Val>{l.leadStatus}</Val>,
      fill: (l) => ({ tone: toneFor(tones.status, l.leadStatus) }),
    },
    {
      key: "potential",
      label: "เกรด",
      sort: (l: LeadRow) => l.potential,
      align: "center",
      width: 64,
      cell: (l) => <Val>{l.potential}</Val>,
      fill: (l) =>
        l.potential ? { tone: toneFor(tones.potential, l.potential) } : undefined,
    },
    {
      key: "interest",
      label: "สนใจ",
      sort: (l: LeadRow) => l.interest,
      width: 200,
      cell: (l) => <Dim>{l.interest}</Dim>,
    },
    {
      key: "budget",
      label: "งบ",
      sort: (l: LeadRow) => num(l.budgetMillion),
      align: "right",
      width: 90,
      cell: (l) => (
        <Val mono>
          {l.budgetMillion ? `${formatNum(l.budgetMillion)} ลบ.` : null}
        </Val>
      ),
    },
    {
      key: "assigned",
      label: "ผู้ดูแล",
      sort: (l: LeadRow) => l.assignedName,
      width: 100,
      cell: (l) => <Dim>{l.assignedName}</Dim>,
    },
    {
      key: "follow",
      label: "Follow ล่าสุด",
      sort: (l: LeadRow) => l.overdueDays ?? 0,
      width: 120,
      cell: (l) => (
        <span>
          <Dim>{l.followRef ? daysAgoLabel(l.followRef) : null}</Dim>
          {l.overdueDays !== null && l.overdueDays > 0 && (
            <span className="num pl-1.5 text-[0.68rem] font-semibold">
              +{l.overdueDays}
            </span>
          )}
        </span>
      ),
      fill: (l) =>
        l.overdueDays !== null && l.overdueDays > 0
          ? { className: "bg-bad-soft text-bad" }
          : undefined,
    },
    {
      key: "source",
      label: "แหล่งที่มา",
      sort: (l: LeadRow) => l.source,
      width: 110,
      cell: (l) => <Dim>{l.source}</Dim>,
    },
    {
      key: "contactBy",
      label: "ติดต่อผ่าน",
      sort: (l: LeadRow) => l.contactBy,
      width: 100,
      cell: (l) => <Dim>{l.contactBy}</Dim>,
    },
    {
      key: "leadType",
      label: "ประเภทลีด",
      sort: (l: LeadRow) => l.leadType,
      width: 100,
      cell: (l) => <Dim>{l.leadType}</Dim>,
    },
    {
      key: "created",
      label: "วันที่เข้า",
      sort: (l: LeadRow) => l.createdDate,
      width: 100,
      cell: (l) => (
        <Val mono>{l.createdDate ? formatDate(l.createdDate) : null}</Val>
      ),
    },
    {
      key: "code",
      label: "รหัสเดิม",
      sort: (l: LeadRow) => l.legacyCode,
      width: 100,
      cell: (l) => <Val mono>{l.legacyCode}</Val>,
    },
  ];

  return (
    <SheetTable
      tableKey="leads"
      columns={columns}
      rows={rows}
      rowKey={(l) => l.id}
      href={(l) => `/leads/${l.id}`}
      prefs={prefs}
      caption={caption}
      empty={empty}
    />
  );
}
