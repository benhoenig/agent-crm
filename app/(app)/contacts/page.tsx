import Link from "next/link";
import {
  Button,
  Card,
  EmptyState,
  Input,
  LinkButton,
  LinkedRow,
  PageHeader,
  Pagination,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { listContacts } from "@/lib/repo/contacts";
import { formatDateTime, formatNum } from "@/lib/format";
import { param, pageHref, type Search } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const viewer = await getViewer();

  const filters = {
    q: param(sp, "q") || undefined,
    page: Number(param(sp, "page")) || 1,
  };

  const { rows, total, page, pageCount } = await listContacts(viewer, filters);

  const hrefFor = pageHref("/contacts", sp);

  const scoped = viewer.perms.ownerContacts === "own-listings";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="ผู้ติดต่อ"
        sub={
          scoped
            ? "เห็นเฉพาะผู้ติดต่อที่คุณดูแล"
            : `${formatNum(total)} รายชื่อในสมุดผู้ติดต่อ`
        }
      />

      {/* search bar — plain GET form, server-rendered */}
      <Card className="p-4">
        <form className="flex gap-3">
          <Input
            name="q"
            placeholder="ค้นหา ชื่อ / เบอร์ / LINE ID…"
            defaultValue={filters.q}
            className="max-w-md"
          />
          <Button type="submit" variant="secondary" className="shrink-0">
            กรอง
          </Button>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title={
              filters.q ? "ไม่พบผู้ติดต่อตามคำค้น" : "ยังไม่มีผู้ติดต่อในระบบ"
            }
            hint={
              filters.q
                ? "ลองปรับคำค้นหา"
                : "รายชื่อสร้างจากข้อมูลเจ้าของในทรัพย์และข้อมูลลูกค้าใน Lead — เข้ามาพร้อมเฟส Import หรือเมื่อเพิ่มทรัพย์/Lead ใหม่"
            }
            action={
              filters.q ? (
                <LinkButton variant="secondary" href="/contacts">
                  ล้างคำค้น
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>ชื่อ</Th>
                  <Th>เบอร์</Th>
                  <Th>LINE</Th>
                  <Th>อีเมล</Th>
                  <Th className="text-right">ทรัพย์</Th>
                  <Th>แก้ไขล่าสุด</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <LinkedRow key={o.id} href={`/contacts/${o.id}`}>
                    <Td>
                      <Link href={`/contacts/${o.id}`} className="block font-medium">
                        {o.name ?? "(ไม่มีชื่อ)"}
                      </Link>
                    </Td>
                    <Td>
                      {o.phone ? (
                        <a
                          href={`tel:${o.phone}`}
                          className="num text-accent-text hover:underline"
                        >
                          {o.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-ink-2">{o.lineId ?? "—"}</Td>
                    <Td className="text-ink-2">{o.email ?? "—"}</Td>
                    <Td className="num text-right">{o.listingCount}</Td>
                    <Td className="text-ink-2">{formatDateTime(o.updatedAt)}</Td>
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
