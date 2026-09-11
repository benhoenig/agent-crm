// The ทรัพย์ list, lifted out of its page so TWO routes can render it
// (Ben, 2026-08-29: "make the whole page as a drawer like Klaichan instead").
//
// /listings renders it alone. /listings/<id> renders it with the record's
// drawer open on top — because the detail page is gone and a pasted link has
// to land somewhere that still makes sense. A client-side click on a row
// never reaches that second route at all: app/(app)/@modal intercepts it, so
// the grid you are looking at keeps its scroll, its sort and its columns
// instead of being torn down and rebuilt underneath the drawer.

import {
  Button,
  Card,
  Input,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { ListingsGrid } from "@/components/listings/ListingsGrid";
import { getTablePrefs } from "@/lib/tables/queries";
import { getViewer } from "@/lib/auth/session";
import { ownBook } from "@/lib/repo/scope";
import { optionKeys, toneMaps } from "@/lib/repo/options";
import {
  getAgentOptions,
  getSlaRules,
  getZoneOptions,
  listListings,
} from "@/lib/repo/listings";
import { bkkDate, bkkToday, formatNum } from "@/lib/format";
import { param, type Search } from "@/lib/search-params";
import { overdueBy } from "@/lib/sla";

export async function ListingsIndex({ sp }: { sp: Search }) {
  /* THE VIEWER'S OWN BOOK, not everything they may read (Ben, 2026-08-29).
     ทรัพย์ is the stock you are answerable for; ทรัพย์ทั้งบริษัท is the
     company's. A manager who also sells was getting the second one here. See
     lib/repo/scope.ts ownBook. */
  const viewer = ownBook(await getViewer());

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
    listListings(viewer, filters),
    getZoneOptions(),
    viewer.perms.listings === "all" ? getAgentOptions() : Promise.resolve([]),
    getSlaRules(),
    optionKeys("listing_status"),
    optionKeys("listing_potential"),
    toneMaps("listing_status", "listing_potential"),
    getTablePrefs(viewer.userId),
  ]);

  const today = bkkToday();

  /* The SLA is resolved HERE, not in the grid: the rules live in sla_rules and
     shipping them to the browser to recompute per row would be the same answer
     at more cost. Same three-way fallback as the SQL queues on /today and the
     dashboard — last follow → listing date → creation day. */
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
        title="ทรัพย์"
        sub={`${formatNum(total)} รายการในขอบเขตของคุณ`}
        action={<LinkButton href="/listings/new">+ เพิ่มทรัพย์</LinkButton>}
      />

      {/* filter bar — plain GET form, server-rendered */}
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
            {agents.length > 0 ? (
              <Select name="agent" defaultValue={filters.agentId ?? ""}>
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
