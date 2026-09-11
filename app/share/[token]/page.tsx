import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { getShareRoom, recordShareView } from "@/lib/repo/public";
import { formatBaht, formatNum } from "@/lib/format";
import { submitFeedback } from "./actions";
import { REJECT_REASONS } from "@/lib/share-feedback";

// Token pages never enter an index — the URL is the secret.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Spec({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-ink-3">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export default async function ShareRoomPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const room = await getShareRoom(token);

  if (!room) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-lg font-bold">ลิงก์นี้ปิดไปแล้ว</h1>
        <p className="pt-2 text-sm text-ink-2">
          รายการทรัพย์ชุดนี้ถูกปิดหรือลิงก์ไม่ถูกต้อง — ติดต่อเอเจนต์ของคุณเพื่อรับลิงก์ใหม่
        </p>
      </main>
    );
  }
  await recordShareView(token);

  const media = (key: string) => `/media/${key}?t=${encodeURIComponent(token)}`;
  const answered = room.listings.filter((l) => l.feedback).length;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-accent-text">
          {BRAND} · คัดมาเพื่อคุณ
        </p>
        <h1 className="pt-1 text-xl font-bold">
          {room.buyerName ? `คุณ${room.buyerName}` : "ทรัพย์ที่คัดมาให้คุณ"} ·{" "}
          <span className="num">{formatNum(room.listings.length)}</span> รายการ
        </h1>
        <p className="pt-1 text-sm text-ink-2">
          แตะ “สนใจ” หรือ “ยังไม่ใช่” ใต้แต่ละห้อง — คำตอบของคุณช่วยให้เราคัดชุดต่อไปได้ตรงขึ้น
          {answered > 0 ? ` · ตอบแล้ว ${answered}/${room.listings.length}` : ""}
        </p>
      </header>

      {/* compare table */}
      {room.listings.length > 1 ? (
        <section className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="py-2.5 pl-4 font-medium">ทรัพย์</th>
                <th className="px-2 py-2.5 text-right font-medium">ราคา</th>
                <th className="px-2 py-2.5 text-right font-medium">ตร.ม.</th>
                <th className="px-2 py-2.5 text-right font-medium">นอน/น้ำ</th>
                <th className="px-2 py-2.5 font-medium">ชั้น</th>
                <th className="py-2.5 pr-4 font-medium">ทิศ</th>
              </tr>
            </thead>
            <tbody>
              {room.listings.map((l, i) => (
                <tr key={l.id} className="border-b border-line/50 last:border-0">
                  <td className="py-2 pl-4">
                    <a href={`#l-${l.id}`} className="text-accent-text hover:underline">
                      {i + 1}. {l.listingName ?? l.projectName ?? "ห้อง"}
                    </a>
                  </td>
                  <td className="num px-2 py-2 text-right">
                    {l.askingPrice ? formatBaht(l.askingPrice) : l.rentalPrice ? `${formatBaht(l.rentalPrice)}/ด.` : "—"}
                  </td>
                  <td className="num px-2 py-2 text-right">{l.usableSqm ? formatNum(l.usableSqm) : "—"}</td>
                  <td className="num px-2 py-2 text-right">
                    {l.bed ?? "—"}/{l.bath ?? "—"}
                  </td>
                  <td className="px-2 py-2">{l.floor ?? "—"}</td>
                  <td className="py-2 pr-4">{l.direction ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* cards */}
      {room.listings.map((l, i) => (
        <section
          key={l.id}
          id={`l-${l.id}`}
          className="overflow-hidden rounded-card border border-line bg-surface"
        >
          {l.photoKeys.length > 0 ? (
            <div className="flex snap-x gap-1 overflow-x-auto bg-surface-2">
              {l.photoKeys.slice(0, 8).map((k) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={k}
                  src={media(k)}
                  alt=""
                  loading="lazy"
                  className="h-56 w-auto max-w-[85%] shrink-0 snap-center object-cover"
                />
              ))}
            </div>
          ) : null}

          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">
                  {i + 1}. {l.listingName ?? l.projectName ?? "ห้อง"}
                </h2>
                <p className="pt-0.5 text-sm text-ink-2">
                  {[l.projectName, l.zoneName, l.propertyType].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="text-right">
                {l.askingPrice ? (
                  <div className="num text-lg font-bold text-accent-text">{formatBaht(l.askingPrice)}</div>
                ) : null}
                {l.rentalPrice ? (
                  <div className="num text-sm text-ink-2">{formatBaht(l.rentalPrice)}/เดือน</div>
                ) : null}
                {l.priceRemark ? <div className="text-xs text-ink-3">{l.priceRemark}</div> : null}
              </div>
            </div>

            <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
              <Spec label="ห้องนอน / ห้องน้ำ" value={l.bed || l.bath ? `${l.bed ?? "—"} / ${l.bath ?? "—"}` : null} />
              <Spec label="พื้นที่ใช้สอย" value={l.usableSqm ? `${formatNum(l.usableSqm)} ตร.ม.` : null} />
              <Spec label="ชั้น" value={l.floor} />
              <Spec label="ทิศ" value={l.direction} />
              <Spec label="วิว" value={l.view} />
              <Spec label="สภาพห้อง" value={l.unitCondition} />
            </div>

            {l.googleMapsLink ? (
              <a
                href={l.googleMapsLink}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm text-accent-text hover:underline"
              >
                ดูตำแหน่งบนแผนที่ ↗
              </a>
            ) : null}

            {/* verdict */}
            <div className="border-t border-line pt-4">
              {l.feedback === "interested" ? (
                <p className="text-sm font-semibold text-good">
                  ✓ คุณตอบว่า “สนใจ” — เอเจนต์จะติดต่อกลับเรื่องนัดชมห้องนี้
                </p>
              ) : l.feedback === "rejected" ? (
                <p className="text-sm text-ink-2">
                  คุณตอบว่า “ยังไม่ใช่”
                  {l.feedbackReasons?.length ? ` (${l.feedbackReasons.join(", ")})` : ""} —
                  เปลี่ยนใจเมื่อไหร่กดตอบใหม่ได้เลย
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-2">
                <form action={submitFeedback.bind(null, token, l.id)}>
                  <input type="hidden" name="kind" value="interested" />
                  <button
                    className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
                    type="submit"
                  >
                    ❤ สนใจห้องนี้
                  </button>
                </form>
                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-full border border-line px-5 py-2.5 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
                    ยังไม่ใช่
                  </summary>
                  <form
                    action={submitFeedback.bind(null, token, l.id)}
                    className="mt-2 space-y-2 rounded-card border border-line bg-surface-2 p-4"
                  >
                    <input type="hidden" name="kind" value="rejected" />
                    <p className="text-xs text-ink-3">เพราะอะไร? (เลือกได้หลายข้อ)</p>
                    {REJECT_REASONS.map((r) => (
                      <label key={r} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`reason-${r}`} className="size-4 accent-[var(--accent)]" />
                        {r}
                      </label>
                    ))}
                    <input
                      name="note"
                      placeholder="บอกเพิ่มเติม (ไม่บังคับ)"
                      className="w-full rounded-ctl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold" type="submit">
                      ส่งคำตอบ
                    </button>
                  </form>
                </details>
              </div>
            </div>
          </div>
        </section>
      ))}

      <footer className="pb-6 text-center text-xs text-ink-3">
        ลิงก์นี้จัดทำเฉพาะสำหรับคุณ — กรุณาอย่าส่งต่อ
      </footer>
    </main>
  );
}
