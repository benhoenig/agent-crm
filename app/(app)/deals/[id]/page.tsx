import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  DL,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Pill,
  Select,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { toneMap } from "@/lib/repo/options";
import { getDeal, getDealDocuments, getDealPayouts } from "@/lib/repo/deals";
import { optionKeys } from "@/lib/repo/options";
import { getUserName } from "@/lib/repo/team";
import { reopenDeal, reviewDeal, setDealPayouts } from "../actions";
import {
  DEAL_DOC_TYPE_LABEL,
  toneFor,
} from "@/lib/labels";
import { formatBaht, formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  const detail = await getDeal(viewer, id);
  if (!detail) notFound();

  const [docs, closingTone, payouts, payoutRoles] = await Promise.all([
    getDealDocuments(id),
    toneMap("closing_status"),
    getDealPayouts(id),
    optionKeys("payout_role"),
  ]);
  const d = detail.deal;
  const locked = Boolean(d.reviewedAt);
  const reviewerName = d.reviewedBy ? await getUserName(d.reviewedBy) : null;
  // Existing legs + two blank rows to extend; the action reads them by index.
  const payoutRows = [...payouts, null, null];

  // Group the document vault by type for labeled sections.
  const docGroups = new Map<string, typeof docs>();
  for (const doc of docs) {
    const group = docGroups.get(doc.docType) ?? [];
    group.push(doc);
    docGroups.set(doc.docType, group);
  }

  const title =
    detail.listing?.listingName ??
    detail.listing?.legacyCode ??
    d.legacyCode ??
    "(ไม่มีชื่อ)";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold">{title}</h1>
            {d.closingStatus && (
              <Pill tone={toneFor(closingTone, d.closingStatus)}>
                {d.closingStatus}
              </Pill>
            )}
          </div>
          <p className="num pt-1 text-sm text-ink-3">
            {[d.legacyCode, d.type, detail.salesName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {locked ? (
            viewer.perms.dealReview ? (
              <form action={reopenDeal.bind(null, id)}>
                <Button type="submit" variant="ghost">
                  เปิดแก้ไข
                </Button>
              </form>
            ) : null
          ) : (
            <>
              {viewer.perms.dealReview ? (
                <form action={reviewDeal.bind(null, id)}>
                  <Button type="submit" variant="secondary">
                    ✓ ตรวจและล็อกตัวเลข
                  </Button>
                </form>
              ) : null}
              <LinkButton variant="secondary" href={`/deals/${id}/edit`}>
                แก้ไข
              </LinkButton>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="ข้อมูลดีล" />
            <div className="px-5 pb-5">
              <DL
                cols={3}
                items={[
                  { label: "ประเภท", value: d.type },
                  { label: "ราคาปิด", value: <span className="num">{formatBaht(d.closingPrice)}</span> },
                  { label: "คอมมิชชัน", value: <span className="num">{formatBaht(d.commission)}</span> },
                  { label: "เงินจอง", value: <span className="num">{formatBaht(d.reservationAmount)}</span> },
                  { label: "วันปิด", value: formatDate(d.closingDate) },
                  { label: "วันโอน", value: formatDate(d.transferDate) },
                  { label: "วันรับคอม", value: formatDate(d.receiveDate) },
                  { label: "เซลส์", value: detail.salesName },
                  { label: "Co-Agent", value: d.coAgent },
                  /* LINKED ONLY IF THE VIEWER CAN OPEN THE OTHER SIDE. บัญชี
                     holds deals: "all" with listings and leads at "none" — a
                     money seat, not a property one — so for them these two
                     rows are facts about the deal rather than doors. The names
                     still show: the deal row carries them through an unscoped
                     join, and hiding the name of the unit a commission was
                     earned on would make the deal unreadable to the person
                     checking it. Rendering a link that leads to a 404 is the
                     one thing worth avoiding. */
                  {
                    label: "ลีดที่เกี่ยวข้อง",
                    value: !d.leadId
                      ? "—"
                      : viewer.perms.leads !== "none" ? (
                        <Link href={`/leads/${d.leadId}`} className="text-accent-text hover:underline">
                          {detail.leadContactName ?? "เปิดลีด"} →
                        </Link>
                      ) : (
                        (detail.leadContactName ?? "มีลีดผูกอยู่")
                      ),
                  },
                  {
                    label: "ทรัพย์",
                    value: !detail.listing?.id
                      ? "—"
                      : viewer.perms.listings !== "none" ? (
                        <Link href={`/listings/${detail.listing.id}`} className="text-accent-text hover:underline">
                          {detail.listing.listingName ?? detail.listing.legacyCode} →
                        </Link>
                      ) : (
                        (detail.listing.listingName ?? detail.listing.legacyCode)
                      ),
                  },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="ส่วนแบ่งคอมมิชชัน"
              action={
                locked ? (
                  <Pill tone="good">
                    ตรวจแล้ว{reviewerName ? ` · ${reviewerName}` : ""} ·{" "}
                    {formatDate(d.reviewedAt)}
                  </Pill>
                ) : (
                  <span className="text-xs text-ink-3">
                    ติ๊ก “จ่ายแล้ว” เมื่อโอนจริง — ระบบลงสมุดบัญชีให้
                  </span>
                )
              }
            />
            {locked ? (
              payouts.length === 0 ? (
                <EmptyState title="ไม่มีส่วนแบ่ง" hint="ดีลนี้ถูกล็อกโดยไม่มีการแบ่งคอม" />
              ) : (
                <ul className="divide-y divide-line px-5 pb-4">
                  {payouts.map((leg) => (
                    <li key={leg.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                      <span className="font-semibold">{leg.role}</span>
                      <span className="text-ink-2">{leg.payeeName}</span>
                      {leg.pct != null ? <span className="num text-ink-3">{leg.pct}%</span> : null}
                      <span className="num ml-auto">{formatBaht(leg.amount)}</span>
                      {leg.paid ? (
                        <Pill tone="good">จ่ายแล้ว {formatDate(leg.paidDate)}</Pill>
                      ) : (
                        <Pill tone="warn">ค้างจ่าย</Pill>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <form action={setDealPayouts.bind(null, id)} className="space-y-2 px-5 pb-5">
                {payoutRows.map((leg, i) => (
                  <div
                    key={leg?.id ?? `new-${i}`}
                    className="grid grid-cols-2 items-end gap-2 md:grid-cols-[9rem_1fr_5rem_8rem_9rem_auto]"
                  >
                    <Field label={i === 0 ? "บทบาท" : undefined}>
                      <Select name={`payout-role-${i}`} defaultValue={leg?.role ?? ""}>
                        <option value="">—</option>
                        {payoutRoles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={i === 0 ? "จ่ายให้" : undefined}>
                      <Input name={`payout-payee-${i}`} defaultValue={leg?.payeeName ?? ""} />
                    </Field>
                    <Field label={i === 0 ? "%" : undefined}>
                      <Input name={`payout-pct-${i}`} defaultValue={leg?.pct ?? ""} className="num" />
                    </Field>
                    <Field label={i === 0 ? "จำนวน (฿)" : undefined}>
                      <Input name={`payout-amount-${i}`} defaultValue={leg?.amount ?? ""} className="num" />
                    </Field>
                    <Field label={i === 0 ? "วันที่จ่าย" : undefined}>
                      <Input type="date" name={`payout-paiddate-${i}`} defaultValue={leg?.paidDate ?? ""} />
                    </Field>
                    <label className="flex items-center gap-1.5 pb-2 text-xs">
                      <input
                        type="checkbox"
                        name={`payout-paid-${i}`}
                        defaultChecked={leg?.paid ?? false}
                        className="size-4 accent-[var(--accent)]"
                      />
                      จ่ายแล้ว
                    </label>
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <Button type="submit" variant="secondary">
                    บันทึกส่วนแบ่ง
                  </Button>
                </div>
              </form>
            )}
          </Card>

          <Card>
            <CardHeader title="เอกสาร" />
            {docs.length === 0 ? (
              <EmptyState
                title="ยังไม่มีเอกสาร"
                hint="ไฟล์จาก Google Drive จะย้ายเข้า R2 ในเฟส Import — การอัปโหลดในแอปมาพร้อมกัน"
              />
            ) : (
              <div className="space-y-4 px-5 pb-5">
                {Array.from(docGroups.entries()).map(([docType, group]) => (
                  <div key={docType}>
                    <div className="text-xs font-semibold text-ink-2">
                      {DEAL_DOC_TYPE_LABEL[docType] ?? docType}
                    </div>
                    <ul className="space-y-1 pt-1.5 text-sm">
                      {group.map((doc, i) => (
                        <li key={doc.id} className="flex items-center gap-3">
                          {doc.r2Key ? (
                            <a
                              href={`/media/${doc.r2Key}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent-text hover:underline"
                            >
                              ไฟล์ {i + 1} ({doc.r2Key.split(".").pop()?.toUpperCase()})
                            </a>
                          ) : null}
                          {doc.sourceDriveUrl ? (
                            <a
                              href={doc.sourceDriveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={doc.r2Key ? "text-xs text-ink-3 hover:underline" : "text-accent-text hover:underline"}
                            >
                              {doc.r2Key ? "ต้นฉบับ Drive ↗" : "เปิดไฟล์ (Drive) ↗"}
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* PII card renders ONLY when the repo returned the columns (admin). */}
          {detail.piiVisible && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  ข้อมูลทางกฎหมายผู้ซื้อ / ผู้ขาย
                </h2>
                <span className="text-xs text-ink-3">เห็นเฉพาะแอดมิน</span>
              </div>
              <div className="pt-3">
                <DL
                  cols={2}
                  items={[
                    { label: "ผู้ซื้อ", value: d.buyerFullname },
                    { label: "เลขบัตร (ผู้ซื้อ)", value: d.buyerIdNo ? <span className="num">{d.buyerIdNo}</span> : "—" },
                    { label: "ที่อยู่ผู้ซื้อ", value: d.buyerAddress },
                    { label: "ผู้ขาย", value: d.sellerFullname },
                    { label: "เลขบัตร (ผู้ขาย)", value: d.sellerIdNo ? <span className="num">{d.sellerIdNo}</span> : "—" },
                    { label: "ที่อยู่ผู้ขาย", value: d.sellerAddress },
                  ]}
                />
              </div>
            </Card>
          )}

          {d.remark && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold">หมายเหตุ</h2>
              <p className="pt-3 text-sm whitespace-pre-wrap text-ink-2">
                {d.remark}
              </p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-semibold">ระบบ</h2>
            <div className="space-y-3 pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-2">สร้างเมื่อ</span>
                <span>{formatDateTime(d.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-2">แก้ไขล่าสุด</span>
                <span>{formatDateTime(d.updatedAt)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
