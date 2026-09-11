/* ตรวจดีล — the closed-case board บัญชี works from (Ben, 2026-09-11:
 * "add role บัญชี -> มีหน้ารวมเคสที่ปิด + recheck ความถูกต้อง").
 *
 * THE ORDER OF THE PAGE IS THE ARGUMENT IT MAKES. Money that has not reached
 * the books comes first, then the deals whose fields disagree with each other,
 * then everything else waiting. A plain list of closed deals sorted by date
 * would be easier to build and would have exactly the effect the old
 * arrangement had: 39 closed deals, 0 ever signed off.
 *
 * NOTHING HERE BLOCKS A SIGN-OFF. A flagged deal can still be locked — the
 * person holding the bank statement may know something the rules do not, and a
 * checklist that refuses to be overruled gets worked around rather than read.
 * The flags inform the decision; they do not make it.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  Pill,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import {
  DEAL_ISSUES,
  dealReviewBoard,
  type DealReviewRow,
} from "@/lib/repo/deal-review";
import { baht } from "@/lib/ledger";
import { formatBaht, formatDate, formatNum } from "@/lib/format";
import { reviewDeal } from "../deals/actions";

export const dynamic = "force-dynamic";

/** How many signed-off deals to show. The board is a worklist; the archive of
    everything ever checked is the ดีลปิด tab, which already does that job. */
const REVIEWED_SHOWN = 15;

function IssuePills({ row }: { row: DealReviewRow }) {
  if (row.issues.length === 0)
    return <span className="text-xs text-ink-3">ไม่พบข้อขัดแย้ง</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {row.issues.map((code) => (
        <Pill
          key={code}
          tone={DEAL_ISSUES[code].severity === "high" ? "bad" : "warn"}
        >
          {DEAL_ISSUES[code].label}
        </Pill>
      ))}
    </div>
  );
}

function DealCell({ row }: { row: DealReviewRow }) {
  return (
    <Link href={`/deals/${row.id}`} className="block hover:underline">
      <div className="font-medium">
        {row.listingName ?? row.legacyCode ?? "(ไม่มีชื่อ)"}
      </div>
      <div className="num pt-0.5 text-xs text-ink-3">
        {[row.legacyCode, row.salesName].filter(Boolean).join(" · ") || "—"}
      </div>
    </Link>
  );
}

export default async function DealReviewPage() {
  const viewer = await getViewer();
  if (!viewer.perms.dealReview) redirect("/");

  const board = await dealReviewBoard(viewer);
  const { summary } = board;
  const reviewedWithIssues = board.reviewed.filter((r) => r.issues.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="ตรวจดีล"
        sub="เคสที่ปิดแล้วทั้งหมด — ตรวจตัวเลขให้ตรงกับเงินจริง แล้วล็อกไว้"
        action={<LinkButton variant="secondary" href="/ledger">สมุดบัญชี →</LinkButton>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="รอตรวจ" value={formatNum(summary.pendingCount)} />
        <Stat
          label="ต้องแก้ก่อน"
          value={
            <span className={summary.flaggedCount > 0 ? "text-warn" : undefined}>
              {formatNum(summary.flaggedCount)}
            </span>
          }
          sub={summary.highCount > 0 ? `เร่งด่วน ${summary.highCount}` : undefined}
          subTone="warn"
        />
        <Stat
          label="คอมที่ยังไม่เข้าสมุดบัญชี"
          value={
            <span className={`num ${summary.unpostedSatang > 0 ? "text-warn" : ""}`}>
              {baht(summary.unpostedSatang)}
            </span>
          }
          sub={summary.unpostedSatang > 0 ? "ค่าคอมที่ยังไม่มีรายการในบัญชี" : undefined}
          subTone="warn"
        />
        <Stat label="ตรวจแล้ว" value={formatNum(summary.reviewedCount)} />
      </div>

      {/* ── what disagrees ───────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="ต้องแก้ก่อนตรวจ"
          action={
            <span className="text-xs text-ink-3">
              จุดที่ข้อมูลสองที่ไม่ตรงกัน — ส่วนใหญ่คือวันที่ที่ยังไม่ได้กรอก
            </span>
          }
        />
        {board.flagged.length === 0 ? (
          <EmptyState
            title="ไม่พบข้อขัดแย้งในดีลที่รอตรวจ"
            hint="ตัวเลขบนดีล ส่วนแบ่ง และรายการในสมุดบัญชีตรงกันทั้งหมด"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ดีล</Th>
                <Th className="text-right">คอม</Th>
                <Th>วันรับคอม</Th>
                <Th>สิ่งที่ไม่ตรงกัน</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {board.flagged.map((r) => (
                <tr key={r.id} className="border-b border-line/60 align-top">
                  <Td wrap>
                    <DealCell row={r} />
                  </Td>
                  <Td className="num text-right">{formatBaht(r.commission)}</Td>
                  <Td className={r.receiveDate ? "text-ink-2" : "text-warn"}>
                    {r.receiveDate ? formatDate(r.receiveDate) : "ยังไม่กรอก"}
                  </Td>
                  <Td wrap>
                    <IssuePills row={r} />
                    <ul className="space-y-0.5 pt-1.5">
                      {r.issues.map((code) => (
                        <li key={code} className="text-[0.7rem] leading-relaxed text-ink-3">
                          · {DEAL_ISSUES[code].hint}
                        </li>
                      ))}
                    </ul>
                  </Td>
                  <Td wrap className="text-right">
                    <LinkButton variant="secondary" href={`/deals/${r.id}/edit`}>
                      แก้ไข
                    </LinkButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ── the queue ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={`รอตรวจ (${formatNum(summary.pendingCount)})`}
          action={
            <span className="text-xs text-ink-3">
              กด “ตรวจแล้ว” เพื่อล็อกตัวเลข — หลังล็อกจะแก้ไม่ได้จนกว่าจะเปิดใหม่
            </span>
          }
        />
        {board.pending.length === 0 ? (
          <EmptyState
            title="ตรวจครบทุกดีลแล้ว"
            hint="ดีลที่ปิดใหม่จะขึ้นมาที่นี่เองเมื่อเซลส์บันทึก"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ดีล</Th>
                <Th className="text-right">ราคาปิด</Th>
                <Th className="text-right">คอม</Th>
                <Th className="text-right">แบ่งไปแล้ว</Th>
                <Th>วันปิด</Th>
                <Th>วันรับคอม</Th>
                <Th>ในสมุดบัญชี</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {board.pending.map((r) => (
                <tr key={r.id} className="border-b border-line/60">
                  <Td wrap>
                    <DealCell row={r} />
                    {r.issues.length > 0 ? (
                      <div className="pt-1">
                        <IssuePills row={r} />
                      </div>
                    ) : null}
                  </Td>
                  <Td className="num text-right text-ink-2">
                    {formatBaht(r.closingPrice)}
                  </Td>
                  <Td className="num text-right">{formatBaht(r.commission)}</Td>
                  <Td className="num text-right text-ink-2">
                    {r.legs > 0 ? `${formatBaht(r.splitTotal)} · ${r.paidLegs}/${r.legs} จ่ายแล้ว` : "—"}
                  </Td>
                  <Td className="text-ink-2">{formatDate(r.closingDate)}</Td>
                  <Td className={r.receiveDate ? "text-ink-2" : "text-ink-3"}>
                    {r.receiveDate ? formatDate(r.receiveDate) : "—"}
                  </Td>
                  <Td>
                    {r.revenueRows > 0 ? (
                      <Pill tone="good">ลงแล้ว</Pill>
                    ) : (
                      <Pill tone="muted">ยังไม่ลง</Pill>
                    )}
                  </Td>
                  <Td wrap className="text-right">
                    <form action={reviewDeal.bind(null, r.id)}>
                      <Button type="submit" variant="secondary">
                        ✓ ตรวจแล้ว
                      </Button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ── signed off ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={`ตรวจแล้ว (${formatNum(summary.reviewedCount)})`}
          action={
            reviewedWithIssues.length > 0 ? (
              <span className="text-xs font-semibold text-warn">
                {formatNum(reviewedWithIssues.length)} ดีลที่ล็อกไว้แล้วยังมีข้อขัดแย้ง — ต้องเปิดแก้
              </span>
            ) : (
              <span className="text-xs text-ink-3">
                แสดง {REVIEWED_SHOWN} รายการล่าสุด · ดูทั้งหมดที่แท็บดีลปิด
              </span>
            )
          }
        />
        {board.reviewed.length === 0 ? (
          <EmptyState
            title="ยังไม่มีดีลที่ตรวจแล้ว"
            hint="ดีลที่ตรวจและล็อกแล้วจะมาอยู่ที่นี่ พร้อมชื่อคนตรวจและวันที่"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ดีล</Th>
                <Th className="text-right">คอม</Th>
                <Th>ผู้ตรวจ</Th>
                <Th>วันที่ตรวจ</Th>
                <Th>สถานะ</Th>
              </tr>
            </thead>
            <tbody>
              {/* Problems first: a deal that is locked AND wrong is the worst
                  state on this page — the numbers are frozen at a value that
                  does not add up, and only a reopen can move them. */}
              {[...reviewedWithIssues, ...board.reviewed.filter((r) => r.issues.length === 0)]
                .slice(0, REVIEWED_SHOWN)
                .map((r) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <Td wrap>
                      <DealCell row={r} />
                    </Td>
                    <Td className="num text-right">{formatBaht(r.commission)}</Td>
                    <Td className="text-ink-2">{r.reviewerName ?? "—"}</Td>
                    <Td className="text-ink-2">{formatDate(r.reviewedAt)}</Td>
                    <Td wrap>
                      {r.issues.length > 0 ? (
                        <IssuePills row={r} />
                      ) : (
                        <Pill tone="good">ล็อกแล้ว</Pill>
                      )}
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
