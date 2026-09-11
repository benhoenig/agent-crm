import Link from "next/link";
import {
  Button,
  Card,
  Dot,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Pagination,
  Pill,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { optionKeys, toneMap } from "@/lib/repo/options";
import { getZoneOptions } from "@/lib/repo/listings";
import {
  allowedViews,
  listLastMatches,
  resolveView,
  type LastMatchView,
} from "@/lib/repo/lastmatch";
import { trackView } from "@/lib/repo/views";
import { toneFor } from "@/lib/labels";
import { formatBaht, formatDate, formatNum } from "@/lib/format";
import { param, type Search } from "@/lib/search-params";

export const dynamic = "force-dynamic";

const VIEWS: { key: LastMatchView; label: string }[] = [
  { key: "own", label: "ของฉัน" },
  { key: "team", label: "ทีม" },
  { key: "all", label: "ทั้งหมด" },
];

export default async function LastMatchPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const viewer = await getViewer();

  // Resolved against the viewer's matrix, not just parsed: ?view=all is a URL
  // anybody can type, and hiding the tabs below hides only the tabs. The repo
  // re-resolves it again before the WHERE clause — this is for the UI.
  const view = resolveView(viewer, param(sp, "view") || undefined);
  const views = allowedViews(viewer);

  const filters = {
    view,
    type: param(sp, "type") || undefined,
    zoneId: param(sp, "zone") || undefined,
    propertyType: param(sp, "propertyType") || undefined,
    q: param(sp, "q") || undefined,
    page: Number(param(sp, "page")) || 1,
  };

  const [{ rows, total, page, pageCount }, zones, lastMatchTypes, propertyTypes, lastMatchTone, potentialTone] = await Promise.all([
    listLastMatches(viewer, filters),
    getZoneOptions(),
    optionKeys("last_match_type"),
    optionKeys("property_type"),
    toneMap("last_match_type"),
    toneMap("listing_potential"),
  ]);

  /* Last Match has no detail page — the table IS the data, so the unit of
     exposure is the ROW, not the click. Logging `rows.length` records what
     this page actually put in front of them; a person paging through ทั้งหมด
     twenty-five at a time is the pattern the report exists to surface, and
     counting page-opens would have made that look like twelve clicks.

     An empty result logs nothing (logView drops rows <= 0), so a filter that
     matched no one does not pad anybody's total. */
  trackView(viewer, "last_match", null, rows.length);

  // Preserve other query params when switching view scope / page.
  const buildHref = (overrides: Record<string, string | null>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp))
      if (typeof v === "string" && v) qs.set(k, v);
    for (const [k, v] of Object.entries(overrides))
      if (v === null) qs.delete(k);
      else qs.set(k, v);
    const s = qs.toString();
    return s ? `/last-match?${s}` : "/last-match";
  };
  const viewHref = (v: LastMatchView) =>
    buildHref({ view: v, page: null });
  const hrefFor = (p: number) => buildHref({ page: String(p) });

  const hasFilters = Boolean(
    filters.q || filters.type || filters.zoneId || filters.propertyType
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Last Match"
        sub="ทรัพย์ที่ปิดไปแล้วในตลาด — ใช้เทียบราคาและหาผู้ซื้อ"
        action={<LinkButton href="/last-match/new">+ บันทึก Last Match</LinkButton>}
      />

      {/* view-scope tabs (own/team/all). A viewer who may only see their own
          entries gets no tab row at all — one tab is not a choice, and showing
          ทีม / ทั้งหมด greyed out would only advertise what they cannot have. */}
      {views.length > 1 && (
      <div className="flex gap-1.5">
        {VIEWS.filter((v) => views.includes(v.key)).map((v) => (
          <Link
            key={v.key}
            href={viewHref(v.key)}
            className={
              view === v.key
                ? "inline-flex items-center rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent-text"
                : "inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            }
          >
            {v.label}
          </Link>
        ))}
      </div>
      )}

      <Card className="p-4">
        <form className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input type="hidden" name="view" value={view} />
          <Input
            name="q"
            placeholder="ค้นหา โครงการ / หมายเหตุ / Persona…"
            defaultValue={filters.q}
            className="col-span-2"
          />
          <Select name="type" defaultValue={filters.type ?? ""}>
            <option value="">การปิดทั้งหมด</option>
            {lastMatchTypes.map((t) => (
              <option key={t} value={t}>
                {t}
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
          <Select name="propertyType" defaultValue={filters.propertyType ?? ""}>
            <option value="">ประเภททั้งหมด</option>
            {propertyTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary" className="justify-self-start">
            กรอง
          </Button>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title={
              hasFilters
                ? "ไม่พบรายการตามเงื่อนไข"
                : view === "own"
                  ? "คุณยังไม่มีบันทึก Last Match"
                  : "ยังไม่มีบันทึก Last Match ในขอบเขตนี้"
            }
            hint={
              hasFilters
                ? "ลองปรับตัวกรองหรือล้างคำค้นหา"
                : "ข้อมูลจากชีต Last Match จะเข้ามาในเฟส Import — เห็นทรัพย์ปิดในตลาดเมื่อไหร่ บันทึกได้เลย"
            }
            action={
              hasFilters ? (
                <LinkButton variant="secondary" href={buildHref({ q: null, type: null, zone: null, propertyType: null, page: null })}>
                  ล้างตัวกรอง
                </LinkButton>
              ) : (
                <LinkButton href="/last-match/new">+ บันทึก Last Match</LinkButton>
              )
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>วันที่</Th>
                  <Th>ประเภทการปิด</Th>
                  <Th>โครงการ</Th>
                  <Th>เกรด</Th>
                  <Th>ทรัพย์</Th>
                  <Th>โซน</Th>
                  <Th className="text-right">ราคา</Th>
                  <Th>ชั้น/ตึก</Th>
                  <Th>ผู้บันทึก</Th>
                  <Th>Persona ผู้ซื้อ</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-surface-3">
                    <Td className="whitespace-nowrap text-ink-2">
                      {formatDate(m.matchedAt)}
                    </Td>
                    <Td>
                      {m.type ? (
                        <Dot tone={toneFor(lastMatchTone, m.type)} label={m.type} />
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      {m.projectId ? (
                        <Link
                          href={`/projects/${m.projectId}`}
                          className="font-medium text-accent-text hover:underline"
                        >
                          {m.projectName ?? m.linkedProjectName ?? "(ไม่มีชื่อ)"}
                        </Link>
                      ) : (
                        <span className="font-medium">{m.projectName ?? "—"}</span>
                      )}
                    </Td>
                    <Td>
                      {m.potential ? (
                        <Pill tone={toneFor(potentialTone, m.potential)}>
                          {m.potential}
                        </Pill>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <div className="text-ink-2">{m.propertyType ?? "—"}</div>
                      <div className="num pt-0.5 text-xs text-ink-3">
                        {[
                          m.bed !== null || m.bath !== null
                            ? `${m.bed ?? "—"}/${m.bath ?? "—"}`
                            : null,
                          m.sqm ? `${formatNum(m.sqm)} ตร.ม.` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </Td>
                    <Td className="text-ink-2">{m.zoneName ?? m.zoneCode ?? "—"}</Td>
                    <Td className="num text-right whitespace-nowrap">
                      {formatBaht(m.price)}
                    </Td>
                    <Td className="num text-ink-2">
                      {[m.floor, m.tower].filter(Boolean).join(" / ") || "—"}
                    </Td>
                    <Td className="text-ink-2">{m.salesName ?? "—"}</Td>
                    <Td className="max-w-56">
                      <span className="line-clamp-1 text-ink-2">
                        {m.buyerPersona ?? "—"}
                      </span>
                    </Td>
                  </tr>
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
