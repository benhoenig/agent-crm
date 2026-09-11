// Company-wide listing inventory — every agent's stock, searchable, so a sales
// user with a buyer can find matching property outside their own zones and
// co-broke with whoever holds it. Read-only by construction: rows link to the
// normal detail page, which renders in readOnly mode for listings outside the
// viewer's scope. Owner contact never appears here (see listInventory).
//
// SAME GRID AS /listings (Ben, 2026-08-29: "why does ทรัพย์ทั้งบริษัท and lead
// ทั้งบริษัท table isn't the same kind as the ทรัพย์ and lead?"). It was a
// plain eight-column Table while /listings had been ported to SheetTable, so
// the page you use to BROWSE — the one that most needs sixteen comparable
// columns and a way to hide the ones you don't — was the one still showing
// eight. Same registry, same 30px lattice, same column manager, and the saved
// layout is shared with /listings because it is the same entity: hide ค่าคอม
// once and it is hidden wherever a listing is listed.
//
// THE COVER IMAGE IS GONE with the old table. A 44px thumbnail does not fit a
// 30px row, and shrinking it to fit makes it too small to be the information
// it was there to be. It can come back as its own hideable column if browsing
// turns out to want it.

import { redirect } from "next/navigation";
import {
  Button,
  Card,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { ListingsGrid } from "@/components/listings/ListingsGrid";
import { getTablePrefs } from "@/lib/tables/queries";
import { getViewer } from "@/lib/auth/session";
import { optionKeys, toneMaps } from "@/lib/repo/options";
import {
  getAgentOptions,
  getSlaRules,
  getZoneOptions,
  listInventory,
} from "@/lib/repo/listings";
import { canBrowseDirectory } from "@/lib/repo/scope";
import { bkkDate, bkkToday, formatNum } from "@/lib/format";
import { param, type Search } from "@/lib/search-params";
import { overdueBy } from "@/lib/sla";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!canBrowseDirectory(viewer)) redirect("/listings");

  const filters = {
    q: param(sp, "q") || undefined,
    status: param(sp, "status") || undefined,
    potential: param(sp, "potential") || undefined,
    zoneId: param(sp, "zone") || undefined,
    agentId: param(sp, "agent") || undefined,
  };

  const [
    { rows, total, capped },
    zones,
    agents,
    slaRules,
    listingStatuses,
    listingPotentials,
    tones,
    tablePrefs,
  ] = await Promise.all([
    listInventory(viewer, filters),
    getZoneOptions(),
    getAgentOptions(),
    getSlaRules(),
    optionKeys("listing_status"),
    optionKeys("listing_potential"),
    toneMaps("listing_status", "listing_potential"),
    getTablePrefs(viewer.userId),
  ]);

  const today = bkkToday();

  // Identical mapping to /listings, deliberately: the two pages are one grid
  // over two scopes, and a divergence here would show as two subtly different
  // tables of the same thing.
  const gridRows = rows.map((l) => {
    const followRef = l.lastFollowedAt ?? l.listedAt ?? bkkDate(l.createdAt);
    return {
      id: l.id,
      legacyCode: l.legacyCode,
      listingName: l.listingName,
      zone: l.zoneName ?? l.zoneCode,
      propertyType: l.propertyType,
      listingType: l.listingType,
      potential: l.potential,
      status: l.status,
      askingPrice: l.askingPrice,
      rentalPrice: l.rentalPrice,
      bed: l.bed,
      bath: l.bath,
      usableSqm: l.usableSqm,
      agentName: l.agentName,
      portalPending: l.portalPending,
      listedAt: l.listedAt,
      postedAt: l.postedAt,
      followRef,
      overdueDays: overdueBy(
        slaRules,
        "listing_follow",
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
    filters.q || filters.status || filters.potential || filters.zoneId || filters.agentId
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="ทรัพย์ทั้งบริษัท"
        sub={`${formatNum(total)} รายการ — ทรัพย์ของทุกเซลส์ ค้นหาเพื่อจับคู่ลูกค้าแล้วติดต่อเซลส์ผู้ดูแล`}
      />

      {/* filter bar — plain GET form, server-rendered (same shape as /listings) */}
      <Card className="p-4">
        <form className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input
            name="q"
            placeholder="ค้นหา ชื่อ / รหัส / ซอย…"
            defaultValue={filters.q}
            className="col-span-2"
          />
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">สถานะทั้งหมด</option>
            {listingStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select name="potential" defaultValue={filters.potential ?? ""}>
            <option value="">เกรดทั้งหมด</option>
            {listingPotentials.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Select name="zone" defaultValue={filters.zoneId ?? ""}>
            <option value="">โซนทั้งหมด</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nameThai ?? z.nameEng} ({z.code})
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Select name="agent" defaultValue={filters.agentId ?? ""}>
              <option value="">เซลส์ทุกคน</option>
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

      <ListingsGrid
        rows={gridRows}
        prefs={tablePrefs.listings}
        tones={{
          status: tones.listing_status,
          potential: tones.listing_potential,
        }}
        caption={caption}
        empty={
          hasFilters
            ? "ไม่พบทรัพย์ตามเงื่อนไข — ลองปรับตัวกรองหรือล้างคำค้นหา"
            : "ยังไม่มีทรัพย์ในระบบ"
        }
      />
    </div>
  );
}
