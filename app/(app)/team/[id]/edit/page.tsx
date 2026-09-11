import { notFound } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { getViewer } from "@/lib/auth/session";
import { getManagerOptions, getTeamMember } from "@/lib/repo/team";
import { updateMember } from "../../actions";

export const dynamic = "force-dynamic";

export default async function TeamMemberEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePermission((p) => p.teamManage);
  const viewer = await getViewer();
  const [result, managers] = await Promise.all([
    getTeamMember(viewer, id),
    getManagerOptions(),
  ]);
  if (!result) notFound();
  const { member } = result;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={`แก้ไขประวัติ — ${member.name}`}
        action={
          <LinkButton variant="secondary" href={`/team/${id}`}>
            ยกเลิก
          </LinkButton>
        }
      />

      <form action={updateMember.bind(null, id)} className="space-y-5">
        <Card>
          <CardHeader title="ชื่อและตำแหน่ง" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
            <Field label="ชื่อที่แสดง *">
              <Input name="name" defaultValue={member.name} required />
            </Field>
            <Field label="ชื่อเล่น">
              <Input name="nickname" defaultValue={member.nickname ?? ""} />
            </Field>
            <Field label="รหัสพนักงาน" hint="กำหนดตอนนำเข้า — แก้ไม่ได้">
              <Input value={member.employeeCode ?? "—"} disabled />
            </Field>
            <Field label="ชื่อ (Eng)">
              <Input name="nameEng" defaultValue={member.nameEng ?? ""} />
            </Field>
            <Field label="ชื่อ (ไทย)">
              <Input name="nameThai" defaultValue={member.nameThai ?? ""} />
            </Field>
            <Field label="สถานะพนักงาน">
              <Input
                name="employmentStatus"
                defaultValue={member.employmentStatus ?? ""}
                placeholder="เช่น Active / Probation"
              />
            </Field>
            <Field label="ตำแหน่ง">
              <Input name="position" defaultValue={member.position ?? ""} />
            </Field>
            <Field label="ตำแหน่งรอง">
              <Input
                name="secondPosition"
                defaultValue={member.secondPosition ?? ""}
              />
            </Field>
            <Field label="ฝ่าย">
              <Input name="division" defaultValue={member.division ?? ""} />
            </Field>
            <Field label="ทีม" hint="ใช้จัดกลุ่มมุมมอง 'ทีม' ใน Last Match ฯลฯ">
              <Input name="team" defaultValue={member.team ?? ""} />
            </Field>
            <Field
              label="สังกัดผู้จัดการ"
              hint="ผู้จัดการที่คนนี้อยู่ใต้สังกัด — ผู้จัดการเป็นผู้ตั้งเป้ารายได้และ KPI ให้เซลส์"
            >
              <Select name="managerId" defaultValue={member.managerId ?? ""}>
                <option value="">— ไม่ระบุ —</option>
                {managers
                  .filter((m) => m.id !== id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="เริ่มงาน">
              <Input
                type="date"
                name="dateStarted"
                defaultValue={member.dateStarted ?? ""}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="ข้อมูลส่วนตัว" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
            <Field label="เพศ">
              <Input name="gender" defaultValue={member.gender ?? ""} />
            </Field>
            <Field label="สัญชาติ">
              <Input name="nationality" defaultValue={member.nationality ?? ""} />
            </Field>
            <Field label="วันเกิด">
              <Input type="date" name="birthday" defaultValue={member.birthday ?? ""} />
            </Field>
            <Field label="โทร">
              <Input name="phone" defaultValue={member.phone ?? ""} />
            </Field>
            <Field label="โทร (สำรอง)">
              <Input name="phone2" defaultValue={member.phone2 ?? ""} />
            </Field>
            <Field label="อีเมลงาน">
              <Input name="workEmail" defaultValue={member.workEmail ?? ""} />
            </Field>
            <Field label="เลขบัตรประชาชน">
              <Input name="idCardNo" defaultValue={member.idCardNo ?? ""} />
            </Field>
            <Field label="ที่อยู่" className="sm:col-span-2">
              <Input name="address" defaultValue={member.address ?? ""} />
            </Field>
            <Field label="หมายเหตุ" className="sm:col-span-3">
              <Textarea name="remark" rows={2} defaultValue={member.remark ?? ""} />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <LinkButton variant="secondary" href={`/team/${id}`}>
            ยกเลิก
          </LinkButton>
          <Button type="submit">บันทึกประวัติ</Button>
        </div>
      </form>
    </div>
  );
}
