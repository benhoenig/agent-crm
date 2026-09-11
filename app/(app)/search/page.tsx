import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Pill,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { search, type SearchHit } from "@/lib/repo/search";
import { param, type Search as SearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

function Section({
  title,
  hits,
  allHref,
}: {
  title: string;
  hits: SearchHit[];
  allHref: string;
}) {
  if (hits.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {title}
            <Pill className="num">{hits.length}</Pill>
          </span>
        }
        action={
          <Link
            href={allHref}
            className="text-xs text-accent-text hover:underline"
          >
            ดูทั้งหมด →
          </Link>
        }
      />
      <ul className="divide-y divide-line">
        {hits.map((h) => (
          <li key={h.id}>
            <Link
              href={h.href}
              className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{h.title}</div>
                {h.subtitle && (
                  <div className="num truncate pt-0.5 text-xs text-ink-3">
                    {h.subtitle}
                  </div>
                )}
              </div>
              {h.meta && (
                <span className="shrink-0 text-xs text-ink-3">{h.meta}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const q = param(sp, "q");
  const results = await search(viewer, q);
  const enc = encodeURIComponent(results.q);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="ค้นหา"
        sub="ทรัพย์ · ลูกค้า Lead · ผู้ติดต่อ · โครงการ (เฉพาะที่คุณมีสิทธิ์เห็น)"
      />

      <Card className="p-4">
        <form className="flex gap-3">
          <Input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="ชื่อทรัพย์ · รหัส · เบอร์โทร · ชื่อลูกค้า · โครงการ…"
          />
          <Button type="submit">ค้นหา</Button>
        </form>
      </Card>

      {results.q.length < 2 ? (
        <Card>
          <EmptyState
            title="พิมพ์อย่างน้อย 2 ตัวอักษร"
            hint="ค้นหาได้ด้วยรหัสทรัพย์ (HBH-ST-1), ชื่อโครงการ, ชื่อลูกค้า หรือเบอร์โทร — เบอร์จะจับคู่ได้ทั้งแบบมีขีดและไม่มีขีด"
          />
        </Card>
      ) : results.total === 0 ? (
        <Card>
          <EmptyState
            title={`ไม่พบผลลัพธ์สำหรับ "${results.q}"`}
            hint="ลองใช้คำที่สั้นลง หรือค้นด้วยเบอร์โทร/รหัสทรัพย์"
          />
        </Card>
      ) : (
        <>
          <Section
            title="ทรัพย์"
            hits={results.listings}
            allHref={`/listings?q=${enc}`}
          />
          <Section
            title="ลูกค้า Lead"
            hits={results.leads}
            allHref={`/leads?q=${enc}`}
          />
          <Section
            title="ผู้ติดต่อ"
            hits={results.contacts}
            allHref={`/contacts?q=${enc}`}
          />
          <Section
            title="โครงการ"
            hits={results.projects}
            allHref={`/projects?q=${enc}`}
          />
        </>
      )}
    </div>
  );
}
