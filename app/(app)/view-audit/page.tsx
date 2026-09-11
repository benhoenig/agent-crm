/* ประวัติการเข้าดูข้อมูล — who has been reading the market intelligence.
 *
 * Ben, 2026-09-11: "it's valuable data that we want to see who's been looking
 * at it and have weird behaviors".
 *
 * WHAT THIS PAGE IS FOR, stated plainly because a report nobody understands is
 * a report nobody acts on: the signal that somebody is walking out with the
 * database is VOLUME, not any single open. Everyone reads โครงการ — that is
 * what it is for. What is not normal is a person whose weekly reading is five
 * surveys opening three hundred different ones over two evenings. So the table
 * leads with records-per-day and distinct-records-per-day, and สูงสุด marks the
 * biggest day in the window rather than trying to define "suspicious" for you.
 *
 * WHAT IT CANNOT DO, equally plainly: it sees reading INSIDE the app. It does
 * not see a screenshot, a phone camera pointed at the screen, or notes typed
 * by hand. It is a record for afterwards, not a lock.
 */

import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pill,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import {
  mostViewedProjects,
  viewActivity,
  VIEW_ENTITY_LABEL,
  type ViewEntity,
} from "@/lib/repo/views";
import { VIEW_RETENTION_DAYS } from "@/lib/retention";
import { formatDate, formatNum } from "@/lib/format";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

export default async function ViewAuditPage() {
  await requirePermission((p) => p.viewAudit);

  const [days, topProjects] = await Promise.all([
    viewActivity(WINDOW_DAYS),
    mostViewedProjects(WINDOW_DAYS),
  ]);

  // The busiest single day in the window, used only to mark the outliers. One
  // person's quiet week should not turn the whole column amber, so this is
  // relative to what actually happened rather than a number picked in advance.
  const peak = days.reduce((m, d) => Math.max(m, d.records), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="ประวัติการเข้าดูข้อมูล"
        sub={`ใครเปิดอ่านโครงการและ Last Match ย้อนหลัง ${WINDOW_DAYS} วัน — เก็บบันทึกไว้ ${VIEW_RETENTION_DAYS} วัน แล้วลบอัตโนมัติทุกคืน`}
      />

      <Card>
        <CardHeader
          title="การอ่านรายวัน"
          action={
            <span className="text-xs text-ink-3">
              เรียงวันล่าสุดก่อน · แถวที่อ่านเยอะผิดปกติจะเป็นสีส้ม
            </span>
          }
        />
        {days.length === 0 ? (
          <EmptyState
            title="ยังไม่มีบันทึกการเข้าดู"
            hint="ระบบจะเริ่มบันทึกตั้งแต่มีคนเปิดหน้าโครงการหรือ Last Match"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>วันที่</Th>
                <Th>ผู้ใช้</Th>
                <Th>ข้อมูล</Th>
                <Th className="text-right">รายการที่เห็น</Th>
                <Th className="text-right">ไม่ซ้ำกัน</Th>
                <Th className="text-right">ครั้งที่เปิด</Th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                // Amber at 60% of the window's busiest day — a relative mark,
                // not a verdict. It says "look at this one", nothing more.
                const heavy = peak > 0 && d.records >= peak * 0.6;
                return (
                  <tr
                    key={`${d.day}-${d.userId}-${d.entity}`}
                    className="transition-colors hover:bg-surface-3"
                  >
                    <Td className="whitespace-nowrap text-ink-2">
                      {formatDate(d.day)}
                    </Td>
                    <Td className="font-medium">{d.userName ?? "—"}</Td>
                    <Td>
                      <Pill tone="muted">
                        {VIEW_ENTITY_LABEL[d.entity as ViewEntity] ?? d.entity}
                      </Pill>
                    </Td>
                    <Td
                      className={`num text-right ${heavy ? "font-semibold text-warn" : ""}`}
                    >
                      {formatNum(d.records)}
                    </Td>
                    <Td className="num text-right text-ink-2">
                      {d.distinctRecords > 0 ? formatNum(d.distinctRecords) : "—"}
                    </Td>
                    <Td className="num text-right text-ink-3">
                      {formatNum(d.opens)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          title="โครงการที่ถูกเปิดดูมากที่สุด"
          action={
            <span className="text-xs text-ink-3">
              บอกว่าความสนใจของทีมพุ่งไปที่ไหน ไม่ใช่ว่าใครอ่านเยอะ
            </span>
          }
        />
        {topProjects.length === 0 ? (
          <EmptyState title="ยังไม่มีการเปิดดูโครงการในช่วงนี้" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>โครงการ</Th>
                <Th className="text-right">ครั้งที่เปิด</Th>
                <Th className="text-right">คนที่เปิด</Th>
              </tr>
            </thead>
            <tbody>
              {topProjects.map((p) => (
                <tr key={p.recordId} className="transition-colors hover:bg-surface-3">
                  <Td className="font-medium">{p.name ?? "(ถูกลบแล้ว)"}</Td>
                  <Td className="num text-right">{formatNum(p.opens)}</Td>
                  <Td className="num text-right text-ink-2">
                    {formatNum(p.readers)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="px-1 text-xs leading-relaxed text-ink-3">
        บันทึกนี้เห็นเฉพาะการเปิดอ่านในระบบ — ไม่เห็นการแคปหน้าจอ ถ่ายรูปจอ
        หรือจดมือ · ใช้เป็นหลักฐานย้อนหลัง ไม่ใช่เครื่องป้องกัน
      </p>
    </div>
  );
}
