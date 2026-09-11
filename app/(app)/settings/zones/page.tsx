import { Card, CardHeader } from "@/components/ui";
import { ZonesManager } from "@/components/settings/ZonesManager";
import { listZones } from "@/lib/repo/settings";

export const dynamic = "force-dynamic";

export default async function SettingsZonesPage() {
  const zones = await listZones();

  return (
    <Card>
      <CardHeader title={`โซน (${zones.length})`} />
      <p className="px-5 pb-1 text-xs leading-relaxed text-ink-3">
        พื้นที่ที่เซลส์แต่ละคนดูแล — ใช้แบ่งทรัพย์ โปรเจกต์ และสิทธิ์การเห็นข้อมูลแบบ
        “โซนที่ดูแล” · คลิกแถวเพื่อแก้ไข เปลี่ยนชื่อได้ตลอด ลบได้เฉพาะโซนที่ยังไม่มีข้อมูลอ้างถึง
      </p>
      <ZonesManager zones={zones} />
    </Card>
  );
}
