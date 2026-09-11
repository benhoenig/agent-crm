import Link from "next/link";
import { Card, CardHeader } from "@/components/ui";
import { getRepostMatrix } from "@/lib/repo/reposts";
import { RepostsManager } from "@/components/settings/RepostsManager";

export const dynamic = "force-dynamic";

export default async function RepostSettingsPage() {
  const matrix = await getRepostMatrix();

  return (
    <Card>
      <CardHeader title="รอบดันประกาศ — ดันซ้ำทุกกี่วัน" />
      <p className="px-5 pb-3 text-xs leading-relaxed text-ink-3">
        ตั้งแยกตามเกรด × ช่องทาง · ทรัพย์เข้าคิว{" "}
        <Link href="/reposts" className="text-accent-text hover:underline">
          ดันประกาศ
        </Link>{" "}
        เมื่อครบรอบนับจากวันที่ดันล่าสุด (ยังไม่เคยดัน = นับจากวันที่โพสต์) ·
        นับเฉพาะทรัพย์ที่ ‘โพสต์อยู่’ · เว้นว่าง = คู่นั้นไม่เข้าคิวเลย ·
        ตัวเลขนี้คือภาระงานจริง — ทรัพย์ ÷ จำนวนวัน คือจำนวนครั้งที่ทีมต้องดันทุกวัน
      </p>
      <RepostsManager matrix={matrix} />
    </Card>
  );
}
