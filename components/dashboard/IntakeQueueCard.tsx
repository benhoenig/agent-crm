// รอจ่ายงาน — the lead waiting list, for roles that can assign (intakeAssign).
//
// Admin's job is: enquiry arrives → file it → hand it to an agent. Until
// 2026-08-25 a lead could not exist unassigned, so there was no queue to show.
// Now there is, and this is the surface that stops it silently filling up.
//
// OLDEST FIRST, with the wait in days on every row. A pool sorted newest-first
// hides exactly the leads that need attention most.

import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Pill,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { unassignedLeads } from "@/lib/repo/leads";
import { getAgentOptions } from "@/lib/repo/listings";
import { formatNum } from "@/lib/format";
import type { Viewer } from "@/lib/auth/session";
import { assignLead } from "@/app/(app)/leads/actions";

/** Days a lead may sit before the row starts shouting. */
const STALE_DAYS = 2;

export async function IntakeQueueCard({ viewer }: { viewer: Viewer }) {
  const [{ rows, total }, agents] = await Promise.all([
    unassignedLeads(viewer),
    getAgentOptions(),
  ]);

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            รอจ่ายงาน
            {total > 0 && (
              <Pill tone="warn">
                <span className="num">{formatNum(total)}</span>
              </Pill>
            )}
          </span>
        }
        action={
          <Link
            href="/leads?assigned=none"
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            ดูทั้งหมด →
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="ไม่มี Lead รอจ่ายงาน"
          hint="Lead ที่บันทึกไว้โดยยังไม่เลือกเซลส์ผู้ดูแลจะมารออยู่ที่นี่"
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>ลูกค้า</Th>
              <Th>แหล่งที่มา</Th>
              <Th>รอมาแล้ว</Th>
              <Th className="text-right">มอบหมายให้</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-surface-3">
                <Td>
                  <Link href={`/leads/${l.id}`} className="block">
                    <div className="font-medium">
                      {l.contactName ?? "(ไม่มีชื่อ)"}
                    </div>
                    {l.initialInterest && (
                      <div className="line-clamp-1 pt-0.5 text-xs text-ink-3">
                        {l.initialInterest}
                      </div>
                    )}
                  </Link>
                </Td>
                <Td className="text-ink-2">{l.source ?? "—"}</Td>
                <Td>
                  {l.waitingDays >= STALE_DAYS ? (
                    <Pill tone="bad">
                      <span className="num">{l.waitingDays}</span> วัน
                    </Pill>
                  ) : (
                    <span className="num text-ink-2">{l.waitingDays} วัน</span>
                  )}
                </Td>
                <Td wrap className="text-right">
                  {/* One-click triage: assigning from here should not mean
                      opening the edit form for every enquiry. */}
                  <form
                    action={assignLead.bind(null, l.id)}
                    className="flex items-center justify-end gap-2"
                  >
                    <Select name="agentId" defaultValue="" className="w-32">
                      <option value="">เลือกเซลส์…</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="submit"
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                    >
                      มอบหมาย
                    </Button>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
