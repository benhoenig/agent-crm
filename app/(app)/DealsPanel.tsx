// The ดีลปิด tab of the dashboard (its own page at /deals until 2026-08-25).
//
// Renders the stat row, filter bar and table only — the dashboard owns the
// PageHeader, so the tab strip and the "+ บันทึกดีล" button live there. Detail
// and create still have their own routes (/deals/[id], /deals/new); only the
// LIST moved here, and /deals redirects to this tab.

import Link from "next/link";
import {
  Button,
  Card,
  EmptyState,
  Input,
  LinkButton,
  LinkedRow,
  Pagination,
  Pill,
  Select,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { dealTotals, listDeals } from "@/lib/repo/deals";
import { optionKeys, toneMap } from "@/lib/repo/options";
import { getAgentOptions } from "@/lib/repo/listings";
import { toneFor } from "@/lib/labels";
import { bkkToday, formatBaht, formatDate, formatNum } from "@/lib/format";
import { param, pageHref, type Search } from "@/lib/search-params";
import type { Viewer } from "@/lib/auth/session";

/** Where this panel lives — every filter link has to come back to the tab. */
export const DEALS_TAB_HREF = "/?tab=deals";

export async function DealsPanel({
  viewer,
  sp,
}: {
  viewer: Viewer;
  sp: Search;
}) {
  // Support has deals: "none" — a polite gate rather than empty data. The tab
  // is hidden for them too; this covers a hand-typed ?tab=deals.
  if (viewer.perms.deals === "none") {
    return (
      <Card>
        <EmptyState
          title="บทบาทของคุณไม่มีสิทธิ์เข้าถึงดีล"
          hint="ข้อมูลดีลและคอมมิชชันเปิดให้เฉพาะแอดมิน ผู้จัดการ และเซลส์เจ้าของดีล"
        />
      </Card>
    );
  }

  const filters = {
    q: param(sp, "q") || undefined,
    closingStatus: param(sp, "status") || undefined,
    year: Number(param(sp, "year")) || undefined,
    salesId: param(sp, "sales") || undefined,
    page: Number(param(sp, "page")) || 1,
  };

  const [{ rows, total, page, pageCount }, totals, agents, closingStatuses, closingTone] =
    await Promise.all([
      listDeals(viewer, filters),
      dealTotals(viewer, {
        q: filters.q,
        closingStatus: filters.closingStatus,
        year: filters.year,
        salesId: filters.salesId,
      }),
      viewer.perms.deals === "all" ? getAgentOptions() : Promise.resolve([]),
      optionKeys("closing_status"),
      toneMap("closing_status"),
    ]);

  const currentYear = Number(bkkToday().slice(0, 4));
  const years: number[] = [];
  for (let y = currentYear; y >= 2020; y--) years.push(y);

  const outstanding = Number(totals.commissionOutstanding ?? 0);
  // sp already carries tab=deals, so pagination stays on this tab
  const hrefFor = pageHref("/", sp);

  const hasFilters = Boolean(
    filters.q || filters.closingStatus || filters.year || filters.salesId
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="จำนวนดีล" value={formatNum(totals.dealCount)} />
        <Stat label="มูลค่ารวม" value={formatBaht(totals.closingSum)} />
        <Stat label="คอมมิชชันรวม" value={formatBaht(totals.commissionSum)} />
        <Stat
          label="คอมค้างรับ"
          value={
            <span className={outstanding > 0 ? "text-warn" : undefined}>
              {formatBaht(totals.commissionOutstanding)}
            </span>
          }
          sub={outstanding > 0 ? "ยังไม่ถึงสถานะ Com. Paid" : undefined}
          subTone="warn"
        />
      </div>

      {/* filter bar — plain GET form, server-rendered */}
      <Card className="p-4">
        <form className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {/* keeps the submit on this tab instead of bouncing to ภาพรวม */}
          <input type="hidden" name="tab" value="deals" />
          <Input
            name="q"
            placeholder="ค้นหา รหัสดีล / ทรัพย์ / Co-Agent…"
            defaultValue={filters.q}
            className="col-span-2"
          />
          <Select name="status" defaultValue={filters.closingStatus ?? ""}>
            <option value="">สถานะทั้งหมด</option>
            {closingStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select name="year" defaultValue={filters.year ? String(filters.year) : ""}>
            <option value="">ทุกปี</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <div className="col-span-2 flex gap-2">
            {agents.length > 0 ? (
              <Select name="sales" defaultValue={filters.salesId ?? ""}>
                <option value="">เซลส์ทุกคน</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Button type="submit" variant="secondary" className="shrink-0">
              กรอง
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? "ไม่พบดีลตามเงื่อนไข" : "ยังไม่มีดีลในระบบ"}
            hint={
              hasFilters
                ? "ลองปรับตัวกรองหรือล้างคำค้นหา"
                : "ข้อมูลจากชีต _raw_revenue จะเข้ามาในเฟส Import — หรือบันทึกดีลใหม่ได้เลย"
            }
            action={
              hasFilters ? (
                <LinkButton variant="secondary" href={DEALS_TAB_HREF}>
                  ล้างตัวกรอง
                </LinkButton>
              ) : (
                <LinkButton href="/deals/new">+ บันทึกดีล</LinkButton>
              )
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>ดีล</Th>
                  <Th>ประเภท</Th>
                  <Th className="text-right">ราคาปิด</Th>
                  <Th className="text-right">คอม</Th>
                  <Th>เซลส์</Th>
                  <Th>วันโอน/วันปิด</Th>
                  <Th>สถานะ</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <LinkedRow key={d.id} href={`/deals/${d.id}`}>
                    <Td>
                      <Link href={`/deals/${d.id}`} className="block">
                        <div className="font-medium">
                          {d.listingName ?? d.legacyCode ?? "(ไม่มีชื่อ)"}
                        </div>
                        {d.legacyCode && (
                          <div className="num pt-0.5 text-xs text-ink-3">
                            {d.legacyCode}
                          </div>
                        )}
                      </Link>
                    </Td>
                    <Td className="text-ink-2">{d.type ?? "—"}</Td>
                    <Td className="num text-right">{formatBaht(d.closingPrice)}</Td>
                    <Td className="num text-right">{formatBaht(d.commission)}</Td>
                    <Td className="text-ink-2">{d.salesName ?? "—"}</Td>
                    <Td className="text-ink-2">
                      {formatDate(d.transferDate ?? d.closingDate)}
                    </Td>
                    <Td>
                      {d.closingStatus ? (
                        <Pill tone={toneFor(closingTone, d.closingStatus)}>
                          {d.closingStatus}
                        </Pill>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </LinkedRow>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={pageCount} total={total} hrefFor={hrefFor} />
          </>
        )}
      </Card>
    </div>
  );
}
