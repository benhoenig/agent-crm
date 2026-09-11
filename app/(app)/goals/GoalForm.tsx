import {
  Button,
  Card,
  CardHeader,
  EnumSelect,
  Field,
  Input,
  LinkButton,
  Select,
  Textarea,
} from "@/components/ui";
import { goalStatus, recap } from "@/lib/db/schema";
import type { goals } from "@/lib/db/schema";

type Goal = typeof goals.$inferSelect;

/**
 * Shared create/edit form. `agents` non-empty enables the assignment select
 * (goals: "all" roles); otherwise the goal is pinned to the viewer server-side.
 * Retro fields only render on edit — they're for closing out a goal.
 */
export function GoalForm({
  action,
  goal,
  agents,
  viewerId,
}: {
  action: (fd: FormData) => Promise<void>;
  goal?: Goal;
  agents: { id: string; name: string; nickname: string | null }[];
  viewerId: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <Card>
        <CardHeader title="เป้าหมาย" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Field label="ชื่อเป้าหมาย *" className="sm:col-span-2">
            <Input
              name="name"
              defaultValue={goal?.name ?? ""}
              placeholder="เช่น คอมมิชชัน Q4 / ปิดดีลโซนสาทร"
              required
            />
          </Field>
          {agents.length > 0 && (
            <Field label="ของ">
              <Select name="agentId" defaultValue={goal?.agentId ?? viewerId}>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname ? `${a.name} (${a.nickname})` : a.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="ประเภทเป้าหมาย">
            <Input
              name="goalType"
              defaultValue={goal?.goalType ?? ""}
              placeholder="เช่น Commission / New Listings"
            />
          </Field>
          <Field label="เป้า (บาท)">
            <Input
              name="targetAmount"
              inputMode="numeric"
              defaultValue={goal?.targetAmount ?? ""}
              placeholder="เช่น 300000"
            />
          </Field>
          <Field label="สถานะ">
            <EnumSelect
              name="status"
              values={goalStatus.enumValues}
              defaultValue={goal?.status ?? "In Progress"}
            />
          </Field>
          <Field label="เริ่ม">
            <Input type="date" name="startDate" defaultValue={goal?.startDate ?? ""} />
          </Field>
          <Field label="เส้นตาย">
            <Input type="date" name="targetDate" defaultValue={goal?.targetDate ?? ""} />
          </Field>
          <Field label="หมายเหตุ" className="sm:col-span-2">
            <Textarea name="remark" rows={2} defaultValue={goal?.remark ?? ""} />
          </Field>
        </div>
      </Card>

      {goal && (
        <Card>
          <CardHeader title="Retro — สรุปเมื่อปิดเป้า" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="ผลลัพธ์">
              <EnumSelect
                name="recap"
                values={recap.enumValues}
                defaultValue={goal.recap}
              />
            </Field>
            <Field label="เกิดอะไรขึ้น" className="sm:col-span-2">
              <Textarea
                name="whatHappened"
                rows={2}
                defaultValue={goal.whatHappened ?? ""}
              />
            </Field>
            <Field label="เพราะอะไร" className="sm:col-span-2">
              <Textarea name="why" rows={2} defaultValue={goal.why ?? ""} />
            </Field>
            <Field label="แผนปรับปรุง" className="sm:col-span-2">
              <Textarea
                name="improvementPlan"
                rows={2}
                defaultValue={goal.improvementPlan ?? ""}
              />
            </Field>
          </div>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <LinkButton variant="secondary" href="/goals">
          ยกเลิก
        </LinkButton>
        <Button type="submit">{goal ? "บันทึก" : "สร้างเป้าหมาย"}</Button>
      </div>
    </form>
  );
}
