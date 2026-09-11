// Lead ทั้งบริษัท — every enquiry in the company, searchable, read-only.
//
// THE TWIN OF /inventory, and it exists for the same reason (Ben, 2026-08-29).
// ลูกค้า Lead became each person's own book, so the wide read needed a home of
// its own rather than living inside a page that also means "my work". The two
// directories are deliberately the same page in different nouns: same filter
// bar, same plain table, same pagination, rows linking into the normal detail
// page — nobody should have to learn this one separately, and that includes
// the grid itself: same LeadsGrid, same 30px lattice, same column manager, and
// the saved layout is shared with /leads because it is the same entity.
//
// ผู้จัดการ and แอดมินซัพพอร์ต only. One reads the team's pipeline, the other
// works it; ซัพพอร์ตประกาศ handles property and a sales agent reading every
// other agent's buyers is what zone scoping exists to prevent. Read-only by
// construction: every mutation in app/(app)/leads/actions.ts filters on the
// caller's real leadScope(), so nothing here can be edited from here.

import { redirect } from "next/navigation";
import {
  Button,
  Card,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { LeadsGrid } from "@/components/leads/LeadsGrid";
import { getTablePrefs } from "@/lib/tables/queries";
import { getViewer } from "@/lib/auth/session";
import { pipelineStage } from "@/lib/db/schema";
import { optionKeys, toneMap } from "@/lib/repo/options";
import { listLeadDirectory } from "@/lib/repo/leads";
import { getAgentOptions, getSlaRules } from "@/lib/repo/listings";
import { canBrowseLeadDirectory } from "@/lib/repo/scope";
import { bkkToday, formatNum } from "@/lib/format";
import { param, type Search } from "@/lib/search-params";
import { overdueBy } from "@/lib/sla";

export const dynamic = "force-dynamic";

export default async function LeadDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const viewer = await getViewer();
  // Same shape as /inventory's guard: bounce to the page this one widens,
  // rather than 403ing someone who followed a stale link.
  if (!canBrowseLeadDirectory(viewer)) redirect("/leads");

  const filters = {
    q: param(sp, "q") || undefined,
    stage: param(sp, "stage") || undefined,
    status: param(sp, "status") || undefined,
    potential: param(sp, "potential") || undefined,
    assignedTo: param(sp, "assigned") || undefined,
  };

  const [
    { rows, total, capped },
    agents,
    slaRules,
    leadStatuses,
    leadPotentials,
    leadStatusTone,
    potentialTone,
    tablePrefs,
  ] = await Promise.all([
    listLeadDirectory(viewer, filters),
    getAgentOptions(),
    getSlaRules(),
    optionKeys("lead_status"),
    optionKeys("lead_potential"),
    toneMap("lead_status"),
    toneMap("lead_potential"),
    getTablePrefs(viewer.userId),
  ]);

  const today = bkkToday();

  // Identical mapping to /leads — one grid over two scopes.
  const gridRows = rows.map((l) => {
    const followRef = l.lastFollowedAt ?? l.createdDate;
    return {
      id: l.id,
      legacyCode: l.legacyCode,
      contactName: l.contactName,
      contactPhone: l.contactPhone,
      interest: l.listingName ?? l.initialInterest,
      leadType: l.leadType,
      source: l.source,
      contactBy: l.contactBy,
      potential: l.potential,
      pipelineStage: l.pipelineStage,
      leadStatus: l.leadStatus,
      budgetMillion: l.budgetMillion,
      assignedName: l.assignedName,
      createdDate: l.createdDate,
      followRef,
      overdueDays: overdueBy(slaRules, "lead_follow", l.potential, followRef, today),
    };
  });

  /* The caption says the TRUE size of the set, and admits the cap when it
     bites (lib/tables GRID_MAX_ROWS). A list quietly showing a prefix reads as
     a complete list, which is the one thing it must never do. */
  const caption = capped
    ? `แสดง ${formatNum(rows.length)} จาก ${formatNum(total)} รายการ — กรองเพื่อดูให้ครบ`
    : `${formatNum(total)} รายการ`;

  const hasFilters = Boolean(
    filters.q ||
      filters.stage ||
      filters.status ||
      filters.potential ||
      filters.assignedTo
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Lead ทั้งบริษัท"
        sub={`${formatNum(total)} รายการ — Lead ของทุกเซลส์ ดูอย่างเดียว แก้ไขที่หน้าของ Lead นั้น`}
      />

      {/* filter bar — plain GET form, server-rendered (same shape as /leads) */}
      <Card className="p-4">
        <form className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input
            name="q"
            placeholder="ค้นหา ชื่อ / เบอร์ / รหัส…"
            defaultValue={filters.q}
            className="col-span-2"
          />
          <Select name="stage" defaultValue={filters.stage ?? ""}>
            <option value="">ทุกขั้นตอน</option>
            {pipelineStage.enumValues.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">สถานะทั้งหมด</option>
            {leadStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select name="potential" defaultValue={filters.potential ?? ""}>
            <option value="">เกรดทั้งหมด</option>
            {leadPotentials.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            {/* "none" is the waiting list — filed but not yet handed out, and
                the one thing แอดมินซัพพอร์ต opens this page to find. */}
            <Select name="assigned" defaultValue={filters.assignedTo ?? ""}>
              <option value="">เซลส์ทุกคน</option>
              <option value="none">ยังไม่มอบหมาย</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" className="shrink-0">
              กรอง
            </Button>
          </div>
        </form>
      </Card>

      <LeadsGrid
        rows={gridRows}
        prefs={tablePrefs.leads}
        tones={{ status: leadStatusTone, potential: potentialTone }}
        caption={caption}
        empty={
          hasFilters
            ? "ไม่พบ Lead ตามเงื่อนไข — ลองปรับตัวกรองหรือล้างคำค้นหา"
            : "ยังไม่มี Lead ในระบบ"
        }
      />
    </div>
  );
}
