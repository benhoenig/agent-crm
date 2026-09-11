import Link from "next/link";
import { Card, CardHeader } from "@/components/ui";
import { listSlaMatrix } from "@/lib/repo/settings";
import { SlaManager } from "@/components/settings/SlaManager";

export const dynamic = "force-dynamic";

export default async function SettingsSlaPage() {
  const rows = await listSlaMatrix();

  return (
    <Card>
      <CardHeader title="SLA ติดตามงาน — เกินกี่วันถือว่า “ค้าง”" />
      <p className="px-5 pb-3 text-xs leading-relaxed text-ink-3">
        ตัวเลขนี้ขับทุกป้าย “ค้าง” ในระบบพร้อมกัน — คิวในแผนวันนี้ ตัวเลขแดชบอร์ด
        และป้ายบนรายการทรัพย์/Lead · ตั้งแยกตามเกรด เว้นว่างไว้ = เกรดนั้นไม่มีป้ายค้าง ·
        เกรดมาจาก{" "}
        <Link
          href="/settings/options?kind=listing_potential"
          className="text-accent-text hover:underline"
        >
          รายการตัวเลือก
        </Link>
      </p>
      <SlaManager rows={rows} />
    </Card>
  );
}
