import Link from "next/link";
import {
  Button,
  Card,
  EmptyState,
  Input,
  LinkButton,
  LinkedRow,
  ListingThumb,
  PageHeader,
  Pagination,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { getZoneOptions } from "@/lib/repo/listings";
import { listProjects } from "@/lib/repo/projects";
import { formatNum } from "@/lib/format";
import { param, pageHref, type Search } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  await getViewer(); // auth gate — projects are shared knowledge, no scoping

  const filters = {
    q: param(sp, "q") || undefined,
    zoneId: param(sp, "zone") || undefined,
    page: Number(param(sp, "page")) || 1,
  };

  const [{ rows, total, page, pageCount }, zones] = await Promise.all([
    listProjects(filters),
    getZoneOptions(),
  ]);

  const hrefFor = pageHref("/projects", sp);

  const hasFilters = Boolean(filters.q || filters.zoneId);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="โครงการ"
        sub={`ฐานความรู้โครงการ · ${formatNum(total)} โครงการ`}
        action={<LinkButton href="/projects/new">+ เพิ่มโครงการ</LinkButton>}
      />

      <Card className="p-4">
        <form className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Input
            name="q"
            placeholder="ค้นหา ชื่อโครงการ / ผู้พัฒนา / คีย์เวิร์ด…"
            defaultValue={filters.q}
            className="col-span-2"
          />
          <Select name="zone" defaultValue={filters.zoneId ?? ""}>
            <option value="">โซนทั้งหมด</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nameThai ?? z.nameEng} ({z.code})
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
            title={hasFilters ? "ไม่พบโครงการตามเงื่อนไข" : "ยังไม่มีโครงการในระบบ"}
            hint={
              hasFilters
                ? "ลองปรับตัวกรองหรือล้างคำค้นหา"
                : "ข้อมูล 49 ฟิลด์จากชีต Projects จะเข้ามาในเฟส Import — หรือเพิ่มโครงการใหม่ได้เลย"
            }
            action={
              hasFilters ? (
                <LinkButton variant="secondary" href="/projects">
                  ล้างตัวกรอง
                </LinkButton>
              ) : (
                <LinkButton href="/projects/new">+ เพิ่มโครงการ</LinkButton>
              )
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>โครงการ</Th>
                  <Th>ประเภท</Th>
                  <Th>โซน</Th>
                  <Th>ผู้พัฒนา</Th>
                  <Th>ปีที่สร้าง</Th>
                  <Th>ยูนิต</Th>
                  <Th className="text-right">Persona</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <LinkedRow key={p.id} href={`/projects/${p.id}`}>
                    <Td>
                      {/* Thumbnail beside the name, the way /listings and
                          /inventory already do it — reusing ListingThumb, which
                          already survives an R2 key whose object is gone (the
                          import left several). A list of buildings you can
                          recognise is half of "อ่านง่ายขึ้นเหมือนดูทรัพย์ใน
                          website"; the other half is on the record itself. */}
                      <Link href={`/projects/${p.id}`} className="flex items-center gap-2.5">
                        <ListingThumb thumbKey={p.coverKey ?? null} />
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {p.nameEng ?? p.nameThai ?? "(ไม่มีชื่อ)"}
                          </span>
                          {p.nameEng && p.nameThai && (
                            <span className="block pt-0.5 text-xs text-ink-3">
                              {p.nameThai}
                            </span>
                          )}
                        </span>
                      </Link>
                    </Td>
                    <Td className="text-ink-2">{p.propertyType ?? "—"}</Td>
                    <Td className="text-ink-2">{p.zoneName ?? p.zoneCode ?? "—"}</Td>
                    <Td className="text-ink-2">{p.developer ?? "—"}</Td>
                    <Td className="num text-ink-2">{p.yearBuilt ?? "—"}</Td>
                    <Td className="text-ink-2">{p.units ?? "—"}</Td>
                    <Td className="num text-right">{p.personaCount ?? 0}</Td>
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
