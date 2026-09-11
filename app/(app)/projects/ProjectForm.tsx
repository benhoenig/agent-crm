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
import type { projects } from "@/lib/db/schema";
import type { getZoneOptions } from "@/lib/repo/listings";

type Project = typeof projects.$inferSelect;

/** Shared create/edit form for the 49-field knowledge base. Everything is
 *  free text by design (sheet vocabulary like "ประมาณ 2,248 ยูนิต") — only
 *  the zone is a FK select. zoneRaw (import provenance) is never editable. */
export function ProjectForm({
  action,
  zones,
  defaults,
  cancelHref,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  zones: Awaited<ReturnType<typeof getZoneOptions>>;
  defaults?: Partial<Project>;
  cancelHref: string;
  submitLabel: string;
}) {
  const d = defaults ?? {};

  return (
    <form action={action} className="space-y-5">
      <Card>
        <CardHeader title="ภาพรวม" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-4">
          <Field label="ชื่อโครงการ (Eng)" className="col-span-2">
            <Input name="nameEng" defaultValue={d.nameEng ?? ""} placeholder="เช่น The Diplomat Sathorn" />
          </Field>
          <Field label="ชื่อโครงการ (ไทย)" className="col-span-2">
            <Input name="nameThai" defaultValue={d.nameThai ?? ""} placeholder="เช่น เดอะ ดิโพลแมท สาทร" />
          </Field>
          <Field label="ประเภทโครงการ" hint="คำจากชีต เช่น Condo High-rise">
            <Input name="propertyType" defaultValue={d.propertyType ?? ""} />
          </Field>
          <Field label="โซน">
            <Select name="zoneId" defaultValue={d.zoneId ?? ""}>
              <option value="">— เลือกโซน —</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nameThai ?? z.nameEng} ({z.code})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ผู้พัฒนา (Developer)" className="col-span-2">
            <Input name="developer" defaultValue={d.developer ?? ""} />
          </Field>
          <Field label="ปีที่สร้างเสร็จ">
            <Input name="yearBuilt" defaultValue={d.yearBuilt ?? ""} className="num" />
          </Field>
          <Field label="จำนวนตึก">
            <Input name="buildings" defaultValue={d.buildings ?? ""} />
          </Field>
          <Field label="จำนวนชั้น">
            <Input name="floors" defaultValue={d.floors ?? ""} />
          </Field>
          <Field label="จำนวนยูนิต" hint="ตามชีต เช่น ประมาณ 2,248 ยูนิต">
            <Input name="units" defaultValue={d.units ?? ""} />
          </Field>
          <Field label="ยูนิตต่อชั้น">
            <Input name="unitsPerFloor" defaultValue={d.unitsPerFloor ?? ""} />
          </Field>
          <Field label="เซกเมนต์">
            <Input name="segment" defaultValue={d.segment ?? ""} placeholder="เช่น Luxury" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="ค่าส่วนกลาง & ที่จอด" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-4">
          <Field label="ค่าส่วนกลาง">
            <Input name="commonFee" defaultValue={d.commonFee ?? ""} placeholder="เช่น 45 บาท/ตรม./เดือน" />
          </Field>
          <Field label="เงื่อนไขการชำระค่าส่วนกลาง">
            <Input name="commonFeeTerms" defaultValue={d.commonFeeTerms ?? ""} />
          </Field>
          <Field label="% การเก็บค่าส่วนกลาง">
            <Input name="commonFeeCollectionPct" defaultValue={d.commonFeeCollectionPct ?? ""} />
          </Field>
          <Field label="นิติบุคคล">
            <Input name="juristicPerson" defaultValue={d.juristicPerson ?? ""} />
          </Field>
          <Field label="อัตราส่วนที่จอดรถ">
            <Input name="parkingRatio" defaultValue={d.parkingRatio ?? ""} placeholder="เช่น 50%" />
          </Field>
          <Field label="ซื้อที่จอดเพิ่มได้หรือไม่">
            <Input name="extraParkingPurchasable" defaultValue={d.extraParkingPurchasable ?? ""} />
          </Field>
          <Field label="ค่าที่จอดเพิ่ม">
            <Input name="extraParkingFee" defaultValue={d.extraParkingFee ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="ราคา & ผลตอบแทน" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-4">
          <Field label="ราคาเฉลี่ย / ตร.ม.">
            <Input name="avgPricePerSqm" defaultValue={d.avgPricePerSqm ?? ""} />
          </Field>
          <Field label="Rental Yield">
            <Input name="rentalYield" defaultValue={d.rentalYield ?? ""} />
          </Field>
          <Field label="โครงการเทียบเคียง (Comparables)" className="col-span-2 md:col-span-4">
            <Textarea name="comparables" rows={2} defaultValue={d.comparables ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="สเปคยูนิต" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-4">
          <Field label="แบบยูนิต (Unit Types)" className="col-span-2 md:col-span-4">
            <Textarea name="unitTypes" rows={2} defaultValue={d.unitTypes ?? ""} />
          </Field>
          <Field label="ความสูงฝ้าเพดาน">
            <Input name="ceilingHeight" defaultValue={d.ceilingHeight ?? ""} />
          </Field>
          <Field label="วิวที่ดีที่สุด">
            <Input name="bestView" defaultValue={d.bestView ?? ""} />
          </Field>
          <Field label="ทิศที่ดีที่สุด">
            <Input name="bestDirection" defaultValue={d.bestDirection ?? ""} />
          </Field>
          <Field label="ตำแหน่งที่ดีที่สุด">
            <Input name="bestPosition" defaultValue={d.bestPosition ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="ไลฟ์สไตล์ & บริบท" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-4">
          <Field label="สัดส่วนสัญชาติผู้อยู่อาศัย">
            <Input name="nationalityMix" defaultValue={d.nationalityMix ?? ""} />
          </Field>
          <Field label="เลี้ยงสัตว์">
            <Input name="petsAllowed" defaultValue={d.petsAllowed ?? ""} />
          </Field>
          <Field label="สูบบุหรี่">
            <Input name="smokingAllowed" defaultValue={d.smokingAllowed ?? ""} />
          </Field>
          <Field label="สถานีรถไฟฟ้าใกล้สุด">
            <Input name="nearestStationInfo" defaultValue={d.nearestStationInfo ?? ""} />
          </Field>
          <Field label="รถ Shuttle">
            <Input name="shuttleInfo" defaultValue={d.shuttleInfo ?? ""} />
          </Field>
          <Field label="ร้านค้าในโครงการ" className="col-span-2 md:col-span-3">
            <Input name="shops" defaultValue={d.shops ?? ""} />
          </Field>
          <Field label="จุดเด่นโครงการ" className="col-span-2">
            <Textarea name="highlights" rows={3} defaultValue={d.highlights ?? ""} />
          </Field>
          <Field label="สิ่งอำนวยความสะดวกส่วนกลาง" className="col-span-2">
            <Textarea name="commonFacilities" rows={3} defaultValue={d.commonFacilities ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="การขาย & การตลาด" />
        <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
          <Field label="คีย์เวิร์ด">
            <Textarea name="keywords" rows={2} defaultValue={d.keywords ?? ""} />
          </Field>
          <Field label="กลุ่มลูกค้าเป้าหมาย">
            <Textarea name="targetCustomers" rows={2} defaultValue={d.targetCustomers ?? ""} />
          </Field>
          <Field label="คอนเซปต์" className="md:col-span-2">
            <Textarea name="concept" rows={3} defaultValue={d.concept ?? ""} />
          </Field>
          <Field label="ข้อดี">
            <Textarea name="pros" rows={4} defaultValue={d.pros ?? ""} />
          </Field>
          <Field label="ข้อเสีย">
            <Textarea name="cons" rows={4} defaultValue={d.cons ?? ""} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="การประเมินหลังแผ่นดินไหว" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-3">
          <Field label="ประวัติการซ่อมแซม">
            <Input name="quakeRepairHistory" defaultValue={d.quakeRepairHistory ?? ""} />
          </Field>
          <Field label="ใบรับรองความปลอดภัยโครงสร้าง">
            <Input name="quakeSafetyCert" defaultValue={d.quakeSafetyCert ?? ""} />
          </Field>
          <Field label="ประกันภัยแผ่นดินไหว">
            <Input name="quakeInsurance" defaultValue={d.quakeInsurance ?? ""} />
          </Field>
          <Field label="รอยร้าวภายนอกอาคาร">
            <Input name="quakeExteriorCracks" defaultValue={d.quakeExteriorCracks ?? ""} />
          </Field>
          <Field label="สภาพรอยต่ออาคาร">
            <Input name="quakeJointsCondition" defaultValue={d.quakeJointsCondition ?? ""} />
          </Field>
          <Field label="สภาพภายในอาคาร">
            <Input name="quakeInteriorCondition" defaultValue={d.quakeInteriorCondition ?? ""} />
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
