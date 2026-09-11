import { notFound } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { param, type Search } from "@/lib/search-params";
import { getContact } from "@/lib/repo/contacts";
import { updateContact } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  // updateContact sends you back here when the number would not take, rather
  // than to the record — this is where the field is.
  const phoneError = param(await searchParams, "phone");
  const viewer = await getViewer();
  const contact = await getContact(viewer, id);
  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={`แก้ไข: ${contact.name ?? "ผู้ติดต่อ"}`}
        sub="รายชื่อสร้างจากฟอร์มทรัพย์และฟอร์ม Lead — หน้านี้แก้ไขข้อมูลติดต่อเท่านั้น"
      />

      {phoneError && (
        <p className="rounded-ctl bg-bad-soft px-4 py-2.5 text-sm text-bad">
          {phoneError === "taken"
            ? "เบอร์โทรนี้เป็นของรายชื่ออื่นอยู่แล้ว — ข้อมูลอื่นบันทึกเรียบร้อย เบอร์โทรยังเป็นค่าเดิม"
            : "เบอร์โทรไม่ถูกต้อง — ข้อมูลอื่นบันทึกเรียบร้อย เบอร์โทรยังเป็นค่าเดิม"}
        </p>
      )}

      <form action={updateContact.bind(null, id)} className="space-y-5">
        <Card>
          <CardHeader title="ข้อมูลผู้ติดต่อ" />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-3">
            <Field label="ชื่อ">
              <Input name="name" defaultValue={contact.name ?? ""} />
            </Field>
            <Field
              label="เบอร์โทร"
              hint="เบอร์โทรคือคีย์จับคู่รายชื่อ (dedup) — เปลี่ยนแล้วทรัพย์/Lead ใหม่อาจไม่จับคู่กับรายนี้"
            >
              <Input name="phone" defaultValue={contact.phone ?? ""} className="num" />
            </Field>
            <Field label="LINE ID">
              <Input name="lineId" defaultValue={contact.lineId ?? ""} />
            </Field>
            <Field label="อีเมล">
              <Input type="email" name="email" defaultValue={contact.email ?? ""} />
            </Field>
            <Field label="เพศ">
              <Input name="gender" defaultValue={contact.gender ?? ""} />
            </Field>
            <Field label="สัญชาติ">
              <Input name="nationality" defaultValue={contact.nationality ?? ""} />
            </Field>
            <Field label="หมายเหตุ" className="col-span-2 md:col-span-3">
              <Textarea name="remark" rows={4} defaultValue={contact.remark ?? ""} />
            </Field>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <LinkButton variant="ghost" href={`/contacts/${id}`}>
            ยกเลิก
          </LinkButton>
          <Button type="submit">บันทึกการแก้ไข</Button>
        </div>
      </form>
    </div>
  );
}
