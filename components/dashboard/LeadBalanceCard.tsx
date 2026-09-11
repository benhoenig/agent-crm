// การกระจายงาน — open leads per agent, for roles that assign (intakeAssign).
//
// Pairs with IntakeQueueCard because they are ONE decision: you cannot hand out
// an enquiry well without seeing who is already buried. On dev the spread is
// 199 open leads to 0 across five agents, which nothing in the app showed.
//
// Bars are relative to the busiest agent, not to a target — there is no "right"
// number of leads, only a shape, and the shape is the point.

import { Card, CardHeader, EmptyState, Pill } from "@/components/ui";
import { getLeadBalance } from "@/lib/repo/dashboard";
import { formatNum } from "@/lib/format";

export async function LeadBalanceCard() {
  const { active, stranded } = await getLeadBalance();
  const max = Math.max(...active.map((a) => a.open_leads), 0);
  const total = active.reduce((sum, a) => sum + a.open_leads, 0);

  return (
    <Card>
      <CardHeader title="การกระจายงาน (Lead ที่เปิดอยู่)" />
      {active.length === 0 ? (
        <EmptyState title="ยังไม่มีเซลส์ในระบบ" />
      ) : (
        <div className="space-y-2 px-5 pb-5 pt-1">
          <p className="pb-1 text-xs text-ink-3">
            รวม <span className="num">{formatNum(total)}</span> Lead
            ที่เปิดอยู่ · เรียงจากคนที่ถืองานมากที่สุด
          </p>
          {active.map((a) => (
            <div key={a.id} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-xs text-ink-2">
                {a.name}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded-ctl bg-surface-3">
                <div
                  className="h-full rounded-ctl bg-accent-soft"
                  style={{ width: max > 0 ? `${(a.open_leads / max) * 100}%` : "0%" }}
                />
              </div>
              <span className="num w-10 shrink-0 text-right text-sm">
                {formatNum(a.open_leads)}
              </span>
            </div>
          ))}

          {/* Work assigned to a login that no longer works. These agents are
              (correctly) absent from the list above, so this is the only place
              the leads they still hold can surface. */}
          {stranded > 0 && (
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm text-ink-2">
                Lead ที่ค้างอยู่กับบัญชีที่ถูกระงับ
              </span>
              <Pill tone="bad">
                <span className="num">{formatNum(stranded)}</span> รายการ
              </Pill>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
