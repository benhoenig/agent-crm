import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LinkButton,
  Select,
  Textarea,
} from "@/components/ui";
import type { deals } from "@/lib/db/schema";
import { optionKeys } from "@/lib/repo/options";
import type { Viewer } from "@/lib/auth/session";
import type { listingOptionsForDeal } from "@/lib/repo/deals";
import type { getAgentOptions } from "@/lib/repo/listings";

type Deal = typeof deals.$inferSelect;

/** Shared create/edit form (server component).
 *
 *  - Lead linking is deliberately not offered here — historic deal ↔ lead
 *    links happen at import; an in-app linker is a later enhancement.
 *  - The PII section (buyer/seller legal identity) renders for admin only;
 *    non-admin submits carry no PII fields and the update action omits those
 *    columns from SET. */
export async function DealForm({
  action,
  viewer,
  listingOptions,
  agents,
  defaults,
  cancelHref,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  viewer: Viewer;
  listingOptions: Awaited<ReturnType<typeof listingOptionsForDeal>>;
  agents: Awaited<ReturnType<typeof getAgentOptions>>;
  defaults?: Partial<Deal>;
  cancelHref: string;
  submitLabel: string;
}) {
  const d = defaults ?? {};
  const showPII = viewer.perms.dealLegalPII;
  const closingStatuses = await optionKeys("closing_status");

  return (
    <form action={action} className="space-y-5">
      <Card>
        <CardHeader title="ข้อมูลดีล" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-4">
          <Field label="ทรัพย์ (Listing)" className="col-span-2">
            <Select name="listingId" defaultValue={d.listingId ?? ""}>
              <option value="">— ไม่ผูกกับทรัพย์ —</option>
              {listingOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.listingName ?? l.legacyCode ?? "(ไม่มีชื่อ)"}
                  {l.listingName && l.legacyCode ? ` · ${l.legacyCode}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ประเภท" hint="ตามชีต _raw_revenue">
            <Input name="type" defaultValue={d.type ?? ""} placeholder="Sale / Rent" />
          </Field>
          <Field label="สถานะการปิด">
            <Select name="closingStatus" defaultValue={d.closingStatus ?? ""}>
              <option value="">— เลือก —</option>
              {closingStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          {viewer.perms.deals === "all" ? (
            <Field label="เซลส์">
              <Select name="salesId" defaultValue={d.salesId ?? viewer.userId}>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Co-Agent">
            <Input name="coAgent" defaultValue={d.coAgent ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="มูลค่า & วันที่" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-3">
          <Field label="ราคาปิด (฿)">
            <Input name="closingPrice" defaultValue={d.closingPrice ?? ""} className="num" placeholder="9,400,000" />
          </Field>
          <Field label="คอมมิชชัน (฿)">
            <Input name="commission" defaultValue={d.commission ?? ""} className="num" />
          </Field>
          <Field label="เงินจอง (฿)">
            <Input name="reservationAmount" defaultValue={d.reservationAmount ?? ""} className="num" />
          </Field>
          <Field label="วันปิด">
            <Input type="date" name="closingDate" defaultValue={d.closingDate ?? ""} />
          </Field>
          <Field label="วันโอน">
            <Input type="date" name="transferDate" defaultValue={d.transferDate ?? ""} />
          </Field>
          <Field label="วันรับคอมมิชชัน" hint="วันที่เงินเข้าบัญชีจริง — ใช้ลงสมุดบัญชี">
            <Input type="date" name="receiveDate" defaultValue={d.receiveDate ?? ""} />
          </Field>
        </div>
      </Card>

      {showPII ? (
        <Card>
          <CardHeader
            title="ข้อมูลทางกฎหมายผู้ซื้อ / ผู้ขาย"
            action={<span className="text-xs text-ink-3">เห็นเฉพาะแอดมิน</span>}
          />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-3">
            <Field label="ชื่อ-สกุลผู้ซื้อ">
              <Input name="buyerFullname" defaultValue={d.buyerFullname ?? ""} />
            </Field>
            <Field label="ที่อยู่ผู้ซื้อ">
              <Input name="buyerAddress" defaultValue={d.buyerAddress ?? ""} />
            </Field>
            <Field label="เลขบัตรประชาชนผู้ซื้อ">
              <Input name="buyerIdNo" defaultValue={d.buyerIdNo ?? ""} className="num" />
            </Field>
            <Field label="ชื่อ-สกุลผู้ขาย">
              <Input name="sellerFullname" defaultValue={d.sellerFullname ?? ""} />
            </Field>
            <Field label="ที่อยู่ผู้ขาย">
              <Input name="sellerAddress" defaultValue={d.sellerAddress ?? ""} />
            </Field>
            <Field label="เลขบัตรประชาชนผู้ขาย">
              <Input name="sellerIdNo" defaultValue={d.sellerIdNo ?? ""} className="num" />
            </Field>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="หมายเหตุ" />
        <div className="px-5 pb-5">
          <Field label="Remark">
            <Textarea name="remark" rows={4} defaultValue={d.remark ?? ""} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <LinkButton variant="ghost" href={cancelHref}>
          ยกเลิก
        </LinkButton>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
