import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Pill,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { getDueReposts, getPushStats } from "@/lib/repo/reposts";
import { toneMap } from "@/lib/repo/options";
import { toneFor } from "@/lib/labels";
import { bkkToday, formatDate, formatNum } from "@/lib/format";
import { logRepost } from "./actions";

export const dynamic = "force-dynamic";

function daysOver(dueDate: string, today: string): number {
  return Math.round(
    (new Date(`${today}T00:00:00`).getTime() -
      new Date(`${dueDate}T00:00:00`).getTime()) /
      86400000
  );
}

export default async function RepostsPage() {
  const viewer = await getViewer();
  if (!viewer.perms.listingUpdateQueue) redirect("/");

  const [due, stats, potentialTone] = await Promise.all([
    getDueReposts(),
    getPushStats(),
    toneMap("listing_potential"),
  ]);
  const today = bkkToday();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="ดันประกาศ"
        sub="ประกาศที่ถึงรอบดันตามเกรด — กด “ดันแล้ว” เมื่อดันจริง แถวจะหายไปจนถึงรอบหน้า"
        action={
          viewer.perms.settings ? (
            <Link
              href="/settings/reposts"
              className="text-sm text-accent-text hover:underline"
            >
              ตั้งรอบดัน →
            </Link>
          ) : undefined
        }
      />

      {stats.length > 0 ? (
        <Card>
          <CardHeader title="สถิติการดัน (เดือนนี้ / เดือนก่อน)" />
          <div className="flex flex-wrap gap-4 px-5 pb-5">
            {stats.map((s) => (
              <div key={s.name} className="rounded-ctl border border-line px-4 py-2.5">
                <div className="text-xs text-ink-3">{s.name}</div>
                <div className="num pt-0.5 text-lg font-semibold">
                  {formatNum(s.thisMonth)}
                  <span className="pl-1.5 text-xs font-normal text-ink-3">
                    / {formatNum(s.lastMonth)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={`ถึงรอบดัน (${formatNum(due.length)})`}
          action={<span className="text-xs text-ink-3">เรียงตามค้างนานสุด</span>}
        />
        {due.length === 0 ? (
          <EmptyState
            title="ไม่มีประกาศถึงรอบดัน"
            hint="ทุกช่องทางอยู่ในรอบ — หรือยังไม่ได้ตั้งรอบดันใน ตั้งค่า"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ทรัพย์</Th>
                <Th>เกรด</Th>
                <Th>ช่องทาง</Th>
                <Th>ดันล่าสุด</Th>
                <Th>ถึงรอบเมื่อ</Th>
                <Th className="text-right">ค้าง</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {due.map((r) => (
                <tr key={`${r.listingId}-${r.channel}`} className="border-b border-line/60">
                  <Td>
                    <Link href={`/listings/${r.listingId}`} className="hover:underline">
                      {r.listingName ?? r.legacyCode ?? "ทรัพย์"}
                    </Link>
                    {r.projectName ? (
                      <span className="pl-2 text-xs text-ink-3">{r.projectName}</span>
                    ) : null}
                  </Td>
                  <Td>
                    {r.potential ? (
                      <Pill tone={toneFor(potentialTone, r.potential)}>{r.potential}</Pill>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-text hover:underline"
                      >
                        {r.channel} ↗
                      </a>
                    ) : (
                      r.channel
                    )}
                  </Td>
                  <Td className="num">{r.lastPushedAt ? formatDate(r.lastPushedAt) : "ยังไม่เคย"}</Td>
                  <Td className="num">{formatDate(r.dueDate)}</Td>
                  <Td className="num text-right">
                    <span className={daysOver(r.dueDate, today) > 7 ? "font-semibold text-bad" : "text-warn"}>
                      {formatNum(daysOver(r.dueDate, today))} วัน
                    </span>
                  </Td>
                  <Td wrap className="text-right">
                    <form action={logRepost.bind(null, r.listingId, r.channel)}>
                      <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                        ✓ ดันแล้ว
                      </Button>
                    </form>
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
