import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { getOwnerReport, recordOwnerView } from "@/lib/repo/public";
import { toneMap } from "@/lib/repo/options";
import { toneFor } from "@/lib/labels";
import { Pill } from "@/components/ui";
import { bkkToday, formatBaht, formatDate, formatNum } from "@/lib/format";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function daysBetween(from: string, to: string): number {
  return Math.max(
    0,
    Math.round(
      (new Date(`${to}T00:00:00`).getTime() -
        new Date(`${from}T00:00:00`).getTime()) /
        86400000
    )
  );
}

export default async function OwnerReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getOwnerReport(token);

  if (!report) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-lg font-bold">ลิงก์นี้ปิดไปแล้ว</h1>
        <p className="pt-2 text-sm text-ink-2">
          รายงานนี้ถูกปิดหรือลิงก์ไม่ถูกต้อง — ติดต่อเอเจนต์ของคุณเพื่อรับลิงก์ใหม่
        </p>
      </main>
    );
  }
  await recordOwnerView(token);
  const statusTone = await toneMap("listing_status");
  const today = bkkToday();
  const media = (key: string) => `/media/${key}?t=${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-accent-text">
          {BRAND} · รายงานความคืบหน้า
        </p>
        <h1 className="pt-1 text-xl font-bold">
          ทรัพย์ของ{report.ownerName ? `คุณ${report.ownerName}` : "คุณ"} ·{" "}
          <span className="num">{formatNum(report.listings.length)}</span> รายการ
        </h1>
        <p className="pt-1 text-sm text-ink-2">
          สถานะการตลาดของทรัพย์แต่ละรายการที่ฝากไว้กับเรา — อัปเดตสดจากระบบ
        </p>
      </header>

      {report.listings.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-6 text-sm text-ink-2">
          ยังไม่มีทรัพย์ผูกกับรายงานนี้
        </p>
      ) : (
        report.listings.map((l) => (
          <section key={l.id} className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="flex gap-4 p-5">
              {l.photoKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media(l.photoKey)}
                  alt=""
                  className="hidden h-28 w-36 shrink-0 rounded-ctl object-cover sm:block"
                />
              ) : null}
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold">{l.listingName ?? "ทรัพย์"}</h2>
                  {l.status ? <Pill tone={toneFor(statusTone, l.status)}>{l.status}</Pill> : null}
                </div>
                <div className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
                  {l.askingPrice ? (
                    <div className="flex justify-between gap-3">
                      <span className="text-ink-3">ราคาขาย</span>
                      <span className="num">{formatBaht(l.askingPrice)}</span>
                    </div>
                  ) : null}
                  {l.rentalPrice ? (
                    <div className="flex justify-between gap-3">
                      <span className="text-ink-3">ค่าเช่า</span>
                      <span className="num">{formatBaht(l.rentalPrice)}/ด.</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-3">เริ่มฝากขาย</span>
                    <span>{formatDate(l.listedAt) || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-3">อยู่ในตลาดมาแล้ว</span>
                    <span className="num">
                      {l.listedAt ? `${formatNum(daysBetween(l.listedAt, today))} วัน` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-3">กิจกรรม 30 วันล่าสุด</span>
                    <span className="num">{formatNum(l.followUps30d)} ครั้ง</span>
                  </div>
                </div>

                {l.channels.length > 0 ? (
                  <div>
                    <p className="pb-1.5 text-xs font-semibold text-ink-3">ช่องทางที่ลงประกาศ</p>
                    <div className="flex flex-wrap gap-1.5">
                      {l.channels.map((c) => (
                        <span
                          key={c.channel}
                          className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2"
                        >
                          {c.channel}
                          {c.boosted ? " · Boost" : ""}
                          {c.lastPushedAt ? ` · ดันล่าสุด ${formatDate(c.lastPushedAt)}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ))
      )}

      <footer className="pb-6 text-center text-xs text-ink-3">
        ลิงก์นี้จัดทำเฉพาะสำหรับเจ้าของทรัพย์ — กรุณาอย่าส่งต่อ
      </footer>
    </main>
  );
}
