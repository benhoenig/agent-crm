// The ลูกค้า list, lifted out of its page so TWO routes can render it — the
// twin of app/(app)/listings/ListingsIndex.tsx, and for the same reason
// (Ben, 2026-08-29). /leads renders it alone; /leads/<id> renders it with
// that lead's drawer open over it, for the hard loads interception cannot
// catch.

import {
  Button,
  Card,
  Input,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { LeadsGrid } from "@/components/leads/LeadsGrid";
import { getTablePrefs } from "@/lib/tables/queries";
import { getViewer } from "@/lib/auth/session";
import { ownBook } from "@/lib/repo/scope";
import { pipelineStage } from "@/lib/db/schema";
import { optionKeys, toneMap } from "@/lib/repo/options";
import { listLeads } from "@/lib/repo/leads";
import { getAgentOptions, getSlaRules } from "@/lib/repo/listings";
import { bkkToday, formatNum } from "@/lib/format";
import { param, type Search } from "@/lib/search-params";
import { overdueBy } from "@/lib/sla";

export async function LeadsIndex({ sp }: { sp: Search }) {
  /* THE VIEWER'S OWN BOOK — see /listings for the reasoning, and
     /lead-directory for where the company-wide read went. */
  const viewer = ownBook(await getViewer());

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
    listLeads(viewer, filters),
    viewer.perms.intakeAssign ? getAgentOptions() : Promise.resolve([]),
    getSlaRules(),
    optionKeys("lead_status"),
    optionKeys("lead_potential"),
    toneMap("lead_status"),
    toneMap("lead_potential"),
    getTablePrefs(viewer.userId),
  ]);

  const today = bkkToday();

  /* The SLA is resolved HERE, not in the grid: the rules live in sla_rules and
     shipping them to the browser to recompute per row would be the same answer
     at more cost. Fallback is last follow → the day the lead came in. */
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
      overdueDays: overdueBy(
        slaRules,
        "lead_follow",
        l.potential,
        followRef,
        today
      ),
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
        title="ลูกค้า (Leads)"
        sub={`${formatNum(total)} รายการในขอบเขตของคุณ`}
        action={
          // Hidden for roles that cannot create one (sales, listing
          // support). createLead refuses them anyway; a button that always
          // bounces you is worse than no button.
          viewer.perms.leadCreate ? (
            <LinkButton href="/leads/new">+ เพิ่ม Lead</LinkButton>
          ) : null
        }
      />

      {/* filter bar — plain GET form, server-rendered */}
      <Card className="p-4">
        <form className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input
            name="q"
            placeholder="ค้นหา ชื่อ / เบอร์ / ความสนใจ…"
            defaultValue={filters.q}
            className="col-span-2"
          />
          <Select name="stage" defaultValue={filters.stage ?? ""}>
            <option value="">Stage ทั้งหมด</option>
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
            {viewer.perms.intakeAssign ? (
              <Select name="assigned" defaultValue={filters.assignedTo ?? ""}>
                <option value="">เซลส์ทุกคน</option>
                <option value="none">— รอจ่ายงาน (ยังไม่มอบหมาย) —</option>
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

      <LeadsGrid
        rows={gridRows}
        prefs={tablePrefs.leads}
        tones={{ status: leadStatusTone, potential: potentialTone }}
        caption={caption}
        empty={
          hasFilters
            ? "ไม่พบลูกค้าตามเงื่อนไข — ลองปรับตัวกรองหรือล้างคำค้นหา"
            : "ยังไม่มีลูกค้าในระบบ"
        }
      />
    </div>
  );
}
