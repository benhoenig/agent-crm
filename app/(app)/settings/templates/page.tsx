import Link from "next/link";
import { Card, CardHeader, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatNum } from "@/lib/format";
import { param, type Search } from "@/lib/search-params";
import { getTemplateMatrix, TIERS } from "@/lib/repo/copy-templates";
import { TemplatesManager } from "@/components/settings/TemplatesManager";
import { OrphanTemplates } from "@/components/settings/OrphanTemplates";
import type { CopyTier } from "@/lib/copy-templates";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<CopyTier, string> = {
  high: "เกรดพรีเมียม",
  low: "เกรดทั่วไป",
};

export default async function TemplatesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const matrix = await getTemplateMatrix();

  const type =
    matrix.types.find((t) => t.key === param(sp, "type")) ?? matrix.types[0];
  const tier: CopyTier = TIERS.includes(param(sp, "tier") as CopyTier)
    ? (param(sp, "tier") as CopyTier)
    : "high";
  const cell = type?.cells.find((c) => c.tier === tier) ?? null;

  return (
    <div className="space-y-5">
      <Card className="p-4 text-sm leading-relaxed text-ink-2">
        เทมเพลตคือ “เสียง” ของโพสต์ — ช่องในวงเล็บ &lt;…&gt; ระบบเติมให้จากข้อมูลทรัพย์
        และ<b>ตัดทิ้งทั้งท่อน</b>เมื่อทรัพย์ไม่มีข้อมูลช่องนั้น
        (ไม่มีโพสต์ที่เขียนว่า “ตึก” ค้างไว้เฉยๆ)
        <span className="block pt-1.5 text-xs text-ink-3">
          แยกตาม <b>ประเภทการขาย × เทียร์เกรด</b> — เทียร์พรีเมียมคือทรัพย์ที่เกรดติดเหรียญ
          ‘เกรดพรีเมียม’ ({matrix.hotGrades.length > 0 ? matrix.hotGrades.join(" · ") : "ยังไม่ได้ตั้ง"})
          {" · "}ตั้งเหรียญได้ที่{" "}
          <Link
            href="/settings/options?kind=listing_potential"
            className="text-accent-text hover:underline"
          >
            เกรดประกาศ
          </Link>
        </span>
        {matrix.typeless > 0 ? (
          <span className="mt-2 block rounded-ctl bg-warn-soft px-3 py-2 text-xs text-warn">
            มีทรัพย์ <span className="num">{formatNum(matrix.typeless)}</span>{" "}
            รายการที่ยังไม่ได้ระบุประเภทการขาย — โพสต์ของทรัพย์กลุ่มนี้ใช้สำนวนของ “Sale”
            และแก้ที่นี่ไม่ได้ ต้องไปกรอกประเภทการขายในหน้าทรัพย์ก่อน
          </span>
        ) : null}
      </Card>

      {!type || !cell ? (
        <Card className="p-6 text-sm text-ink-3">
          ยังไม่มีประเภทการขายในรายการตัวเลือก — เพิ่มก่อนที่{" "}
          <Link
            href="/settings/options?kind=listing_type"
            className="text-accent-text hover:underline"
          >
            รายการตัวเลือก → ประเภทการขาย
          </Link>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          {/* type picker — the status on each row is the point of this tab:
              a type with no template of its own is not "unconfigured", it is
              silently posting in another type's voice. */}
          <Card className="self-start p-2">
            <div className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-[0.14em] text-ink-3 uppercase">
              ประเภทการขาย
            </div>
            <nav className="flex flex-col">
              {matrix.types.map((t) => {
                const borrowing = t.cells.some((c) => c.origin === "borrowed");
                // an override that reads like its fallback is not an edit
                const edited = t.cells.some(
                  (c) => c.origin === "edited" && !c.sameAsFallback
                );
                return (
                  <Link
                    key={t.key}
                    href={`/settings/templates?type=${encodeURIComponent(
                      t.key
                    )}&tier=${tier}`}
                    className={cn(
                      "rounded-ctl px-3 py-2 transition-colors",
                      t.key === type.key
                        ? "bg-accent-soft text-accent-text"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    )}
                  >
                    <span
                      className={cn(
                        "block text-sm",
                        t.key === type.key && "font-semibold"
                      )}
                    >
                      {t.key}
                      {t.archived ? (
                        <span className="pl-1.5 text-[10px] text-ink-3">
                          (ซ่อนอยู่)
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1.5 pt-0.5 text-[11px] text-ink-3">
                      <span className="num">{formatNum(t.listings)}</span> ทรัพย์
                      {borrowing ? (
                        <span className="text-warn">· ยืมสำนวน Sale</span>
                      ) : edited ? (
                        <span className="text-good">· แก้เองแล้ว</span>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </Card>

          <Card className="self-start">
            <CardHeader
              title={`${type.key} · ${TIER_LABEL[tier]}`}
              action={
                cell.origin !== "edited" ? (
                  cell.origin === "borrowed" ? (
                    <Pill tone="warn">ยืมสำนวนของ {cell.fallbackFrom}</Pill>
                  ) : (
                    <Pill tone="muted">ค่าเริ่มต้นของระบบ</Pill>
                  )
                ) : !cell.sameAsFallback ? (
                  <Pill tone="info">แก้ไขแล้ว</Pill>
                ) : cell.fallbackOrigin === "borrowed" ? (
                  // adopted off Sale but not yet reworded — the separation is
                  // real even though the words are not different yet
                  <Pill tone="info">แยกออกมาแล้ว · ยังไม่ได้แก้ข้อความ</Pill>
                ) : (
                  // a row that reads exactly like the shipped default: keeping
                  // it changes nothing, so do not call it an edit
                  <Pill tone="muted">เหมือนค่าเริ่มต้น</Pill>
                )
              }
            />
            <div className="flex flex-wrap gap-1.5 border-b border-line px-5 pb-3">
              {type.cells.map((c) => (
                <Link
                  key={c.tier}
                  href={`/settings/templates?type=${encodeURIComponent(
                    type.key
                  )}&tier=${c.tier}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                    c.tier === tier
                      ? "bg-accent-soft font-semibold text-accent-text"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                  )}
                >
                  {TIER_LABEL[c.tier]}
                  <span className="num text-ink-3">
                    {formatNum(c.listings)}
                  </span>
                  {c.origin === "borrowed" ? (
                    <span className="text-warn">•</span>
                  ) : null}
                </Link>
              ))}
            </div>
            <TemplatesManager
              key={`${type.key}|${tier}`}
              cell={cell}
              samples={type.samples}
            />
          </Card>
        </div>
      )}

      {matrix.orphans.length > 0 ? (
        <OrphanTemplates orphans={matrix.orphans} />
      ) : null}
    </div>
  );
}
