import {
  Button,
  Card,
  CardHeader,
  Dot,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pill,
  Select,
  Stat,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import {
  getLeaveBalance,
  listDecidedLeaves,
  listMyLeaves,
  listOnLeaveToday,
  listPendingLeaves,
} from "@/lib/repo/leave";
import { leaveType } from "@/lib/db/schema";
import { LEAVE_STATUS_TONE, LEAVE_TYPE_LABEL, toneFor } from "@/lib/labels";
import { bkkToday, formatDate, formatNum } from "@/lib/format";
import {
  approveLeave,
  cancelLeave,
  rejectLeave,
  requestLeave,
} from "./actions";

export const dynamic = "force-dynamic";

const LEAVE_STATUS_LABEL: Record<string, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติ",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};

function rangeLabel(start: string, end: string) {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

export default async function LeavePage() {
  const viewer = await getViewer();
  const year = Number(bkkToday().slice(0, 4));

  const [balance, myLeaves, onLeaveToday, pending, decided] =
    await Promise.all([
      getLeaveBalance(viewer.userId, year),
      listMyLeaves(viewer),
      listOnLeaveToday(),
      viewer.perms.leaveApprove ? listPendingLeaves() : Promise.resolve([]),
      viewer.perms.leaveApprove ? listDecidedLeaves() : Promise.resolve([]),
    ]);

  const balanceTile = (
    label: string,
    used: number,
    allowance: string | null | undefined
  ) => (
    <Stat
      label={label}
      value={
        allowance != null ? (
          <>
            {formatNum(used)}
            <span className="text-base text-ink-3">/{formatNum(allowance)}</span>
          </>
        ) : (
          formatNum(used)
        )
      }
      sub={allowance != null ? "ใช้ไป / สิทธิ์ทั้งปี" : "ใช้ไป (ยังไม่กำหนดสิทธิ์)"}
    />
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="วันลา"
        sub={`สิทธิ์และการใช้วันลาปี ${year + 543} (นับวันตามปฏิทิน)`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {balanceTile("ลาป่วย", balance.used.sick, balance.allowance?.sickDays)}
        {balanceTile("ลากิจ", balance.used.personal, balance.allowance?.personalDays)}
        {balanceTile("ลาพักร้อน", balance.used.vacation, balance.allowance?.vacationDays)}
      </div>

      {onLeaveToday.length > 0 && (
        <Card className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-2">วันนี้ลา:</span>
            {onLeaveToday.map((p) => (
              <Pill key={p.userId} tone="info">
                {p.nickname ?? p.userName} · {LEAVE_TYPE_LABEL[p.type] ?? p.type}
              </Pill>
            ))}
          </div>
        </Card>
      )}

      {viewer.perms.leaveApprove && (
        <Card>
          <CardHeader
            title={
              <>
                รออนุมัติ{" "}
                {pending.length > 0 && (
                  <Pill tone="warn" className="num ml-1">
                    {pending.length}
                  </Pill>
                )}
              </>
            }
          />
          {pending.length === 0 ? (
            <EmptyState title="ไม่มีคำขอค้างอนุมัติ" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>ผู้ขอ</Th>
                  <Th>ประเภท</Th>
                  <Th>วันที่</Th>
                  <Th className="text-right">วัน</Th>
                  <Th>หมายเหตุ</Th>
                  <Th>ขอเมื่อ</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {pending.map((l) => (
                  <tr key={l.id}>
                    <Td className="font-medium">{l.nickname ?? l.userName}</Td>
                    <Td>{LEAVE_TYPE_LABEL[l.type] ?? l.type}</Td>
                    <Td className="whitespace-nowrap text-ink-2">
                      {rangeLabel(l.startDate, l.endDate)}
                    </Td>
                    <Td className="num text-right">{l.days}</Td>
                    <Td className="max-w-56">
                      <span className="line-clamp-1 text-ink-2">{l.remark ?? "—"}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-3">
                      {formatDate(l.createdAt)}
                    </Td>
                    <Td wrap>
                      {l.userId === viewer.userId ? (
                        <span className="text-xs text-ink-3">
                          รอผู้อนุมัติท่านอื่น
                        </span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <form action={approveLeave.bind(null, l.id)}>
                            <Button type="submit" className="px-3 py-1.5 text-xs">
                              อนุมัติ
                            </Button>
                          </form>
                          <form action={rejectLeave.bind(null, l.id)}>
                            <Button
                              type="submit"
                              variant="danger"
                              className="px-3 py-1.5 text-xs"
                            >
                              ไม่อนุมัติ
                            </Button>
                          </form>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="คำขอของฉัน" />
          {myLeaves.length === 0 ? (
            <EmptyState
              title="ยังไม่มีคำขอวันลา"
              hint="ยื่นคำขอจากฟอร์มด้านขวา — ผู้จัดการ/แอดมินจะได้รับการแจ้งเตือนทันที"
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>ประเภท</Th>
                  <Th>วันที่</Th>
                  <Th className="text-right">วัน</Th>
                  <Th>สถานะ</Th>
                  <Th>หมายเหตุ</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {myLeaves.map((l) => (
                  <tr key={l.id}>
                    <Td>{LEAVE_TYPE_LABEL[l.type] ?? l.type}</Td>
                    <Td className="whitespace-nowrap text-ink-2">
                      {rangeLabel(l.startDate, l.endDate)}
                    </Td>
                    <Td className="num text-right">{l.days}</Td>
                    <Td>
                      <Dot
                        tone={toneFor(LEAVE_STATUS_TONE, l.status)}
                        label={LEAVE_STATUS_LABEL[l.status] ?? l.status}
                      />
                    </Td>
                    <Td className="max-w-48">
                      <span className="line-clamp-1 text-ink-2">{l.remark ?? "—"}</span>
                    </Td>
                    <Td wrap>
                      {l.status === "pending" && (
                        <form action={cancelLeave.bind(null, l.id)}>
                          <button
                            type="submit"
                            className="text-xs text-ink-3 hover:text-bad"
                          >
                            ยกเลิก
                          </button>
                        </form>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card className="self-start">
          <CardHeader title="ยื่นคำขอวันลา" />
          <form action={requestLeave} className="space-y-3 px-5 pb-5">
            <Field label="ประเภท *">
              <Select name="type" required defaultValue="">
                <option value="" disabled>
                  — เลือก —
                </option>
                {leaveType.enumValues.map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_TYPE_LABEL[t] ?? t}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ตั้งแต่ *">
                <Input type="date" name="startDate" required />
              </Field>
              <Field label="ถึง *">
                <Input type="date" name="endDate" required />
              </Field>
            </div>
            <Field label="หมายเหตุ">
              <Textarea name="remark" rows={2} placeholder="เหตุผล / รายละเอียด" />
            </Field>
            <Button type="submit" className="w-full">
              ยื่นคำขอ
            </Button>
          </form>
        </Card>
      </div>

      {viewer.perms.leaveApprove && decided.length > 0 && (
        <Card>
          <CardHeader title="ประวัติการอนุมัติล่าสุด" />
          <Table>
            <thead>
              <tr>
                <Th>ผู้ขอ</Th>
                <Th>ประเภท</Th>
                <Th>วันที่</Th>
                <Th className="text-right">วัน</Th>
                <Th>ผล</Th>
                <Th>ผู้อนุมัติ</Th>
              </tr>
            </thead>
            <tbody>
              {decided.map((l) => (
                <tr key={l.id}>
                  <Td>{l.nickname ?? l.userName}</Td>
                  <Td>{LEAVE_TYPE_LABEL[l.type] ?? l.type}</Td>
                  <Td className="whitespace-nowrap text-ink-2">
                    {rangeLabel(l.startDate, l.endDate)}
                  </Td>
                  <Td className="num text-right">{l.days}</Td>
                  <Td>
                    <Dot
                      tone={toneFor(LEAVE_STATUS_TONE, l.status)}
                      label={LEAVE_STATUS_LABEL[l.status] ?? l.status}
                    />
                  </Td>
                  <Td className="text-ink-2">{l.approverName ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
