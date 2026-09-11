import type { ReactNode } from "react";
import { ContactPicker } from "@/components/contacts/ContactPicker";
import {
  Button,
  Card,
  CardHeader,
  EnumSelect,
  FieldRow,
  FieldRows,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { leads } from "@/lib/db/schema";
import { optionKeys } from "@/lib/repo/options";
import type { Viewer } from "@/lib/auth/session";
import type { listingOptions } from "@/lib/repo/leads";
import type { getAgentOptions } from "@/lib/repo/listings";

type Lead = typeof leads.$inferSelect;

/** Shared create/edit form. `contact*` fields dedupe by phone on create and
 *  apply to the linked contact row on edit (see actions.ts). */
export async function LeadForm({
  action,
  viewer,
  listings,
  agents,
  defaults,
  contactDefaults,
  dedupe,
  aiJobId,
  cancel,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  viewer: Viewer;
  listings: Awaited<ReturnType<typeof listingOptions>>;
  agents: Awaited<ReturnType<typeof getAgentOptions>>;
  defaults?: Partial<Lead>;
  contactDefaults?: {
    name: string | null;
    phone: string | null;
    lineId: string | null;
    email: string | null;
  } | null;
  /** Create forms only — see ContactPicker.dedupe. */
  dedupe?: boolean;
  aiJobId?: number | null;
  /** The footer's ยกเลิก. A <LinkButton> back to the list on the full
   *  page, a <ModalCancelButton> when this form is inside a route modal —
   *  hence a node and not an href. */
  cancel: ReactNode;
  submitLabel: string;
}) {
  const d = defaults ?? {};
  const [leadTypes, marketingChannels, contactChannels, leadPotentials] =
    await Promise.all([
      optionKeys("lead_type"),
      optionKeys("marketing_channel"),
      optionKeys("contact_by"),
      optionKeys("lead_potential"),
    ]);

  return (
    <form action={action} className="space-y-5">
      {aiJobId ? <input type="hidden" name="aiJobId" value={aiJobId} /> : null}
      <Card>
        <CardHeader title="ผู้ติดต่อ" />
        {/* Same picker as the listing's เจ้าของทรัพย์ — same table, same
            phone dedupe, same scope rule. See ContactPicker. */}
        <ContactPicker
          prefix="contact"
          labels={{
            name: "ชื่อลูกค้า *",
            phone: "เบอร์โทร",
            lineId: "LINE ID",
            email: "อีเมล",
          }}
          defaults={contactDefaults}
          withEmail
          nameRequired
          dedupe={dedupe}
        />
      </Card>

      <Card>
        <CardHeader title="ความสนใจ" />
        <FieldRows>
          <FieldRow label="ทรัพย์ที่สนใจ">
            <Select name="listingId" defaultValue={d.listingId ?? ""}>
              <option value="">— ไม่ระบุ —</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.listingName ?? l.legacyCode ?? "(ไม่มีชื่อ)"}
                  {l.listingName && l.legacyCode ? ` (${l.legacyCode})` : ""}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="ความสนใจ (ข้อความ)">
            <Input
              name="initialInterest"
              defaultValue={d.initialInterest ?? ""}
              placeholder="เช่น คอนโด 2 นอน ใกล้ BTS ศาลาแดง"
            />
          </FieldRow>
          <FieldRow label="Lead Type">
            <EnumSelect
              name="leadType"
              values={leadTypes}
              defaultValue={d.leadType}
            />
          </FieldRow>
          <FieldRow label="แหล่งที่มา">
            <EnumSelect
              name="source"
              values={marketingChannels}
              defaultValue={d.source}
            />
          </FieldRow>
          <FieldRow label="ติดต่อผ่าน">
            <EnumSelect
              name="contactBy"
              values={contactChannels}
              defaultValue={d.contactBy}
            />
          </FieldRow>
          <FieldRow label="เกรด (Potential)">
            <Select name="potential" defaultValue={d.potential ?? "New Lead"}>
              {leadPotentials.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </FieldRow>
        </FieldRows>
      </Card>

      <Card>
        <CardHeader title="รายละเอียด" />
        <FieldRows>
          <FieldRow label="งบประมาณ" hint="หน่วย: ล้านบาท">
            <Input
              name="budgetMillion"
              defaultValue={d.budgetMillion ?? ""}
              className="num"
              placeholder="3.5"
            />
          </FieldRow>
          <FieldRow label="Timeline">
            <Input
              name="timeline"
              defaultValue={d.timeline ?? ""}
              placeholder="เช่น ภายใน 3 เดือน"
            />
          </FieldRow>
          <FieldRow label="Background">
            <Textarea
              name="background"
              rows={3}
              defaultValue={d.background ?? ""}
            />
          </FieldRow>
          <FieldRow label="Requirement">
            <Textarea
              name="requirement"
              rows={3}
              defaultValue={d.requirement ?? ""}
            />
          </FieldRow>
          <FieldRow label="Pain Point">
            <Textarea
              name="painPoint"
              rows={3}
              defaultValue={d.painPoint ?? ""}
            />
          </FieldRow>
        </FieldRows>
      </Card>

      {viewer.perms.intakeAssign ? (
        <Card>
          <CardHeader title="ผู้ดูแล" />
          <FieldRows>
            <FieldRow label="เซลส์ผู้ดูแล">
              <Select name="assignedTo" defaultValue={d.assignedTo ?? ""}>
                {/* Empty = leave it in the waiting list for triage later. */}
                <option value="">— ยังไม่มอบหมาย (รอจ่ายงาน) —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FieldRow>
          </FieldRows>
        </Card>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {cancel}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
