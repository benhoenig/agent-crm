import {
  Button,
  Card,
  CardHeader,
  EnumSelect,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { optionKeys } from "@/lib/repo/options";
import {
  getAgentOptions,
  getProjectOptions,
  getZoneOptions,
} from "@/lib/repo/listings";
import { bkkToday } from "@/lib/format";
import { createLastMatch } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewLastMatchPage() {
  const viewer = await getViewer();
  const [zones, projects, agents, lastMatchTypes, potentials, propertyTypes, directions] = await Promise.all([
    getZoneOptions(),
    getProjectOptions(),
    viewer.perms.listings === "all" ? getAgentOptions() : Promise.resolve([]),
    optionKeys("last_match_type"),
    optionKeys("listing_potential"),
    optionKeys("property_type"),
    optionKeys("direction"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="บันทึก Last Match"
        sub="เห็นทรัพย์ปิดในตลาด — จดไว้ทันที ข้อมูลนี้ใช้เทียบราคาและหาผู้ซื้อทั้งทีม"
      />

      <form action={createLastMatch} className="space-y-5">
        <Card>
          <CardHeader title="การปิด" />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-4">
            <Field label="วันที่ปิด">
              <Input type="date" name="matchedAt" defaultValue={bkkToday()} />
            </Field>
            <Field label="ประเภทการปิด">
              <EnumSelect name="type" values={lastMatchTypes} required />
            </Field>
            <Field label="เกรด (Potential)">
              <EnumSelect name="potential" values={potentials} />
            </Field>
            {agents.length > 0 ? (
              <Field label="ผู้บันทึก">
                <Select name="salesId" defaultValue={viewer.userId}>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="โครงการ" className="col-span-2">
              <Select name="projectId" defaultValue="">
                <option value="">— ไม่ระบุ / นอกระบบ —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameEng ?? p.nameThai}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="ชื่อโครงการ (ข้อความ)"
              hint="ถ้าไม่มีในระบบ พิมพ์ชื่อโครงการ"
              className="col-span-2"
            >
              <Input name="projectName" placeholder="เช่น The Diplomat Sathorn" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="ทรัพย์ที่ปิด" />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-4">
            <Field label="ประเภททรัพย์">
              <EnumSelect name="propertyType" values={propertyTypes} />
            </Field>
            <Field label="โซน">
              <Select name="zoneId" defaultValue="">
                <option value="">— เลือกโซน —</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nameThai ?? z.nameEng} ({z.code})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ราคาที่ปิด (฿)" className="col-span-2">
              <Input name="price" className="num" placeholder="9,400,000" />
            </Field>
            <Field label="นอน">
              <Input type="number" name="bed" min={0} className="num" />
            </Field>
            <Field label="น้ำ">
              <Input type="number" name="bath" min={0} className="num" />
            </Field>
            <Field label="ขนาด (ตร.ม.)">
              <Input name="sqm" className="num" />
            </Field>
            <Field label="ทิศ">
              <EnumSelect name="direction" values={directions} />
            </Field>
            <Field label="ชั้น">
              <Input name="floor" className="num" />
            </Field>
            <Field label="ตึก / อาคาร">
              <Input name="tower" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="ข่าวกรอง" />
          <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
            <Field label="หมายเหตุ">
              <Textarea name="remark" rows={4} />
            </Field>
            <Field label="Persona ผู้ซื้อ" hint="ใครซื้อ ทำไมซื้อ — ข่าวกรองชิ้นสำคัญ">
              <Textarea name="buyerPersona" rows={4} />
            </Field>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <LinkButton variant="ghost" href="/last-match">
            ยกเลิก
          </LinkButton>
          <Button type="submit">บันทึก Last Match</Button>
        </div>
      </form>
    </div>
  );
}
