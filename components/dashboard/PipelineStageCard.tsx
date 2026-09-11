// ไปป์ไลน์ — open leads per stage, as a proportional funnel.
//
// IMPORTANT, AND DIFFERENT FROM THE CARD THIS WAS MODELLED ON. Mook's
// StageActivityCard charts stage MOVEMENT inside a window ("how many leads
// advanced"), and its notes say it deliberately replaced a position chart.
// Habihub cannot do that yet: moveLeadStage/setLeadStage UPDATE the row in
// place, and nothing records the transition — the `actions` table logs
// activity categories, not stage changes. So this shows stage POSITION, which
// is what the data supports, and says so in its own subtitle rather than
// letting a reader assume it means movement.
//
// Making it movement needs a lead_stage_events row written on every stage
// change. That is a schema addition and it starts empty — no back-history.

import Link from "next/link";
import { Card, CardHeader, EmptyState, Pill } from "@/components/ui";
import { PIPELINE_STAGE_TONE, toneFor } from "@/lib/labels";
import { formatNum } from "@/lib/format";

export function PipelineStageCard({
  counts,
}: {
  counts: { stage: string; n: number }[];
}) {
  const total = counts.reduce((sum, c) => sum + c.n, 0);
  const max = Math.max(...counts.map((c) => c.n), 0);

  return (
    <Card>
      <CardHeader
        title="ไปป์ไลน์"
        action={
          <Link
            href="/leads?view=board"
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            เปิดบอร์ด →
          </Link>
        }
      />
      {total === 0 ? (
        <EmptyState
          title="ยังไม่มีลูกค้า Active"
          hint="Lead ที่เปิดอยู่จะปรากฏที่นี่ แบ่งตามขั้นตอนการขาย"
        />
      ) : (
        <div className="space-y-2 px-5 pb-5 pt-1">
          <p className="pb-1 text-xs text-ink-3">
            ลูกค้า Active {formatNum(total)} รายการ ณ ตอนนี้ — ตำแหน่งในไปป์ไลน์
          </p>
          {counts.map((c) => (
            <Link
              key={c.stage}
              href={`/leads?stage=${encodeURIComponent(c.stage)}`}
              className="block"
            >
              <div className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-ink-2">{c.stage}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-ctl bg-surface-3">
                  <div
                    className="h-full rounded-ctl bg-accent-soft transition-all"
                    style={{ width: max > 0 ? `${(c.n / max) * 100}%` : "0%" }}
                  />
                </div>
                <Pill tone={toneFor(PIPELINE_STAGE_TONE, c.stage)}>
                  {formatNum(c.n)}
                </Pill>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
