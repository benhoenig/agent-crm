import {
  Button,
  Card,
  CardHeader,
  Dot,
  EmptyState,
  Field,
  Input,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { listLineGroups } from "@/lib/repo/settings";
import { formatDate } from "@/lib/format";
import { addLineGroup, deleteLineGroup, toggleLineGroup } from "../actions";

export const dynamic = "force-dynamic";

export default async function SettingsLinePage() {
  const groups = await listLineGroups();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="เพิ่มกลุ่ม LINE" />
        <form
          action={addLineGroup}
          className="grid gap-3 px-5 pb-5 sm:grid-cols-3"
        >
          <Field
            label="Group ID *"
            hint="เชิญบอทเข้ากลุ่ม แล้วพิมพ์ /groupid ในกลุ่มเพื่อดูค่า"
          >
            <Input name="lineGroupId" placeholder="Cxxxxxxxx…" required />
          </Field>
          <Field label="ชื่อกลุ่ม">
            <Input name="name" placeholder="เช่น Sales Team" />
          </Field>
          <div className="flex items-end">
            <Button type="submit">เพิ่มกลุ่ม</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="กลุ่มที่ใช้คำสั่ง /plan ได้" />
        {groups.length === 0 ? (
          <EmptyState
            title="ยังไม่มีกลุ่มที่อนุญาต"
            hint="บอทจะเงียบในทุกกลุ่มจนกว่ากลุ่มนั้นถูกเพิ่มที่นี่ — ยกเว้น /groupid ที่ตอบเสมอเพื่อใช้ตั้งค่า"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ชื่อกลุ่ม</Th>
                <Th>Group ID</Th>
                <Th>เพิ่มเมื่อ</Th>
                <Th>สถานะ</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <Td className="font-medium">{g.name ?? "—"}</Td>
                  <Td className="num max-w-56 truncate text-ink-2">
                    {g.lineGroupId}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-3">
                    {formatDate(g.createdAt)}
                  </Td>
                  <Td>
                    {g.active ? (
                      <Dot tone="good" label="ใช้งาน" />
                    ) : (
                      <Dot tone="muted" label="ปิด" />
                    )}
                  </Td>
                  <Td wrap>
                    <div className="flex justify-end gap-2">
                      <form action={toggleLineGroup.bind(null, g.id)}>
                        <Button
                          type="submit"
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                        >
                          {g.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </Button>
                      </form>
                      <form action={deleteLineGroup.bind(null, g.id)}>
                        <Button
                          type="submit"
                          variant="danger"
                          className="px-3 py-1.5 text-xs"
                        >
                          ลบ
                        </Button>
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
