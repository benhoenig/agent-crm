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
import type { listings } from "@/lib/db/schema";
import { optionKeys } from "@/lib/repo/options";
import type { Viewer } from "@/lib/auth/session";
import type {
  getAgentOptions,
  getProjectOptions,
  getStationOptions,
  getZoneOptions,
} from "@/lib/repo/listings";

type Listing = typeof listings.$inferSelect;

type Options = {
  zones: Awaited<ReturnType<typeof getZoneOptions>>;
  agents: Awaited<ReturnType<typeof getAgentOptions>>;
  projects: Awaited<ReturnType<typeof getProjectOptions>>;
  stations: Awaited<ReturnType<typeof getStationOptions>>;
};

/** Shared create/edit form. `owner*` defaults come from the linked owner row
 *  (edit) and dedupe by phone on submit — same rule as the import. */
export async function ListingForm({
  action,
  viewer,
  options,
  defaults,
  ownerDefaults,
  dedupe,
  aiJobId,
  cancel,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  viewer: Viewer;
  options: Options;
  defaults?: Partial<Listing>;
  ownerDefaults?: { name: string | null; phone: string | null; lineId: string | null } | null;
  /** Create forms only — see ContactPicker.dedupe. */
  dedupe?: boolean;
  /** Set when the defaults came from an AI parse job — closes it as "saved". */
  aiJobId?: number | null;
  /** The footer's ยกเลิก. A <LinkButton> back to the list on the full
   *  page, a <ModalCancelButton> when this form is inside a route modal —
   *  hence a node and not an href. */
  cancel: ReactNode;
  submitLabel: string;
}) {
  const d = defaults ?? {};
  const [
    listingStatuses,
    listingPotentials,
    listingTypes,
    propertyTypes,
    locationGrades,
    directions,
    unitPositions,
    unitConditions,
    priceRemarks,
  ] = await Promise.all([
    optionKeys("listing_status"),
    optionKeys("listing_potential"),
    optionKeys("listing_type"),
    optionKeys("property_type"),
    optionKeys("location_grade"),
    optionKeys("direction"),
    optionKeys("unit_position"),
    optionKeys("unit_condition"),
    optionKeys("price_remark"),
  ]);
  const stationsOf = (type: "BTS" | "MRT" | "ARL") =>
    options.stations.filter((s) => s.type === type);
  const stationSelect = (
    name: string,
    type: "BTS" | "MRT" | "ARL",
    current: string | null | undefined
  ) => (
    <Select name={name} defaultValue={current ?? ""}>
      <option value="">— ไม่ระบุ —</option>
      {stationsOf(type).map((s) => (
        <option key={s.id} value={s.id}>
          {s.code} · {s.name}
        </option>
      ))}
    </Select>
  );

  return (
    <form action={action} className="space-y-5">
      {aiJobId ? <input type="hidden" name="aiJobId" value={aiJobId} /> : null}
      <Card>
        <CardHeader title="ข้อมูลหลัก" />
        <FieldRows>
          <FieldRow label="ชื่อทรัพย์ (Listing Name)">
            <Input name="listingName" defaultValue={d.listingName ?? ""} placeholder="เช่น บ้าน สิริ สีลม 2 นอน" />
          </FieldRow>
          <FieldRow label="รหัสทรัพย์" hint="เช่น HBH-ST-1 (เว้นว่างได้)">
            <Input name="legacyCode" defaultValue={d.legacyCode ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="สถานะ">
            <EnumSelect name="status" values={listingStatuses} defaultValue={d.status ?? "ข้อมูลยังไม่ครบ"} placeholder="ข้อมูลยังไม่ครบ" />
          </FieldRow>
          <FieldRow label="เกรด (Potential)">
            <EnumSelect name="potential" values={listingPotentials} defaultValue={d.potential} />
          </FieldRow>
          <FieldRow label="รูปแบบ (Sale/Rent)">
            <EnumSelect name="listingType" values={listingTypes} defaultValue={d.listingType} />
          </FieldRow>
          <FieldRow label="ประเภททรัพย์">
            <EnumSelect name="propertyType" values={propertyTypes} defaultValue={d.propertyType} />
          </FieldRow>
          {viewer.perms.listings === "all" ? (
            <FieldRow label="เซลส์ผู้ดูแล">
              <Select name="agentId" defaultValue={d.agentId ?? viewer.userId}>
                {options.agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FieldRow>
          ) : null}
          <FieldRow label="วันที่รับทรัพย์">
            <Input type="date" name="listedAt" defaultValue={d.listedAt ?? ""} />
          </FieldRow>
          <FieldRow label="วันที่โพสต์">
            <Input type="date" name="postedAt" defaultValue={d.postedAt ?? ""} />
          </FieldRow>
          <FieldRow label="วันที่ปิด">
            <Input type="date" name="closedAt" defaultValue={d.closedAt ?? ""} />
          </FieldRow>
        </FieldRows>
      </Card>

      <Card>
        <CardHeader title="ทำเล" />
        <FieldRows>
          <FieldRow label="โซน">
            <Select name="zoneId" defaultValue={d.zoneId ?? ""}>
              <option value="">— เลือกโซน —</option>
              {options.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nameThai ?? z.nameEng} ({z.code})
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="โครงการ">
            <Select name="projectId" defaultValue={d.projectId ?? ""}>
              <option value="">— นอกโครงการ / ไม่ระบุ —</option>
              {options.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameEng ?? p.nameThai}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="ถนน / ซอย">
            <Input name="streetSoi" defaultValue={d.streetSoi ?? ""} />
          </FieldRow>
          <FieldRow label="เกรดทำเล">
            <EnumSelect name="locationGrade" values={locationGrades} defaultValue={d.locationGrade} />
          </FieldRow>
          <FieldRow label="BTS">{stationSelect("btsStationId", "BTS", d.btsStationId)}</FieldRow>
          <FieldRow label="MRT">{stationSelect("mrtStationId", "MRT", d.mrtStationId)}</FieldRow>
          <FieldRow label="ARL">{stationSelect("arlStationId", "ARL", d.arlStationId)}</FieldRow>
          <FieldRow label="ลิงก์ Google Maps">
            <Input name="googleMapsLink" defaultValue={d.googleMapsLink ?? ""} placeholder="https://maps.google.com/…" />
          </FieldRow>
        </FieldRows>
      </Card>

      <Card>
        <CardHeader title="สเปค" />
        <FieldRows>
          <FieldRow label="ชื่อแบบห้อง / Unit Type">
            <Input name="unitTypeName" defaultValue={d.unitTypeName ?? ""} />
          </FieldRow>
          <FieldRow label="เลขห้อง / บ้านเลขที่">
            <Input name="unitNo" defaultValue={d.unitNo ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="นอน">
            <Input type="number" name="bed" min={0} defaultValue={d.bed ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="น้ำ">
            <Input type="number" name="bath" min={0} defaultValue={d.bath ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="ห้องแม่บ้าน">
            <Input type="number" name="maidRoom" min={0} defaultValue={d.maidRoom ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="พื้นที่ใช้สอย (ตร.ม.)">
            <Input name="usableSqm" defaultValue={d.usableSqm ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="ที่ดิน: ไร่">
            <Input type="number" name="landRai" min={0} defaultValue={d.landRai ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="งาน">
            <Input type="number" name="landNgan" min={0} defaultValue={d.landNgan ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="ตร.วา">
            <Input name="landWa" defaultValue={d.landWa ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="ชั้น">
            <Input name="floor" defaultValue={d.floor ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="ตึก / อาคาร">
            <Input name="building" defaultValue={d.building ?? ""} />
          </FieldRow>
          <FieldRow label="วิว">
            <Input name="view" defaultValue={d.view ?? ""} />
          </FieldRow>
          <FieldRow label="ทิศ">
            <EnumSelect name="direction" values={directions} defaultValue={d.direction} />
          </FieldRow>
          <FieldRow label="ตำแหน่งห้อง">
            <EnumSelect name="position" values={unitPositions} defaultValue={d.position} />
          </FieldRow>
          <FieldRow label="ที่จอดรถ">
            <Input name="parking" defaultValue={d.parking ?? ""} />
          </FieldRow>
          <FieldRow label="สภาพห้อง">
            <EnumSelect name="unitCondition" values={unitConditions} defaultValue={d.unitCondition} />
          </FieldRow>
          {/* A checkbox is its own label, so it becomes the row's VALUE and
              the row's label carries the wording. mt-[11px] matches the label
              span's pt: both boxes are 16px, so their tops line up. */}
          <FieldRow label="อยู่ในโครงการจัดสรร">
            <input
              type="checkbox"
              name="inProject"
              defaultChecked={d.inProject ?? false}
              className="size-4 accent-(--accent) sm:mt-2"
            />
          </FieldRow>
        </FieldRows>
      </Card>

      <Card>
        <CardHeader title="ราคา" />
        <FieldRows>
          <FieldRow label="ราคาขาย (฿)">
            <Input name="askingPrice" defaultValue={d.askingPrice ?? ""} className="num" placeholder="9,400,000" />
          </FieldRow>
          <FieldRow label="ราคาเช่า (฿/เดือน)">
            <Input name="rentalPrice" defaultValue={d.rentalPrice ?? ""} className="num" />
          </FieldRow>
          <FieldRow label="เงื่อนไขราคา">
            <EnumSelect name="priceRemark" values={priceRemarks} defaultValue={d.priceRemark} />
          </FieldRow>
        </FieldRows>
      </Card>

      <Card>
        <CardHeader title="เจ้าของทรัพย์" />
        {/* NOT pre-linked on edit, deliberately. The listing already has an
            owner; showing "ผูกกับรายชื่อเดิม" every time you edit is noise,
            and a linked picker stops searching — which is exactly what you
            are here to do when the owner is the thing that changed. Leaving
            it unlinked keeps today's behaviour: untouched, the save re-finds
            this same person by phone and updates them in place. */}
        <ContactPicker
          prefix="owner"
          labels={{ name: "ชื่อเจ้าของ", phone: "เบอร์โทร", lineId: "LINE ID" }}
          defaults={
            ownerDefaults
              ? { ...ownerDefaults, email: null }
              : null
          }
          dedupe={dedupe}
        />
      </Card>

      <Card>
        <CardHeader title="คอนเทนต์ / หมายเหตุ" />
        <FieldRows>
          <FieldRow label="Post Remark (ข้อความประกาศ)">
            <Textarea name="postRemark" rows={4} defaultValue={d.postRemark ?? ""} />
          </FieldRow>
          <FieldRow label="Remark ภายใน">
            <Textarea name="remarkCream" rows={4} defaultValue={d.remarkCream ?? ""} />
          </FieldRow>
        </FieldRows>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {cancel}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
