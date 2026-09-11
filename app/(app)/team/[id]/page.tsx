import { notFound } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  DL,
  Dot,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Pill,
  Select,
  Stat,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { canSeeHrPII, getAllZones, getTeamMember } from "@/lib/repo/team";
import { getLeaveBalance } from "@/lib/repo/leave";
import { allRoles } from "@/lib/repo/roles";
import { bkkToday, formatBaht, formatDate, formatNum } from "@/lib/format";
import { setLeaveAllowance } from "../../leave/actions";
import {
  changeOwnPassword,
  clearLineLink,
  deactivateMember,
  reactivateMember,
  resetMemberPassword,
  setMemberRole,
  setMemberZones,
  uploadAvatar,
} from "../actions";
import { Avatar } from "@/components/ui/Avatar";

export const dynamic = "force-dynamic";

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  const [result, roleRows] = await Promise.all([
    getTeamMember(viewer, id),
    allRoles(),
  ]);
  const roleLabel = Object.fromEntries(roleRows.map((r) => [r.id, r.name]));
  if (!result) notFound();
  const { member, zones: memberZones, stats } = result;

  const isSelf = viewer.userId === id;
  const manage = viewer.perms.teamManage;
  const showPII = canSeeHrPII(viewer, id);
  const allZones = manage ? await getAllZones() : [];
  const assigned = new Set(memberZones.map((z) => z.id));
  const year = Number(bkkToday().slice(0, 4));
  const balance = manage ? await getLeaveBalance(id, year) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar
              image={member.image}
              name={member.nickname ?? member.name}
              size="size-12 text-lg"
            />
            {member.name}
            <Pill tone="accent">{roleLabel[member.role] ?? member.role}</Pill>
            {member.banned && <Pill tone="bad">พ้นสภาพ</Pill>}
          </span>
        }
        sub={[member.position, member.division, member.team]
          .filter(Boolean)
          .join(" · ")}
        action={
          manage ? (
            <LinkButton variant="secondary" href={`/team/${id}/edit`}>
              แก้ไขประวัติ
            </LinkButton>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="ทรัพย์ Active" value={formatNum(stats.activeListings)} />
        <Stat label="ดีลปิดปีนี้" value={formatNum(stats.dealsThisYear)} />
        <Stat
          label="คอมมิชชันปีนี้"
          value={formatBaht(stats.commissionThisYear)}
        />
      </div>

      <Card>
        <CardHeader title="ข้อมูลทั่วไป" />
        <div className="px-5 pb-5">
          <DL
            items={[
              { label: "ชื่อเล่น", value: member.nickname },
              { label: "ชื่อ (Eng)", value: member.nameEng },
              { label: "ชื่อ (ไทย)", value: member.nameThai },
              { label: "ตำแหน่ง", value: member.position },
              { label: "ตำแหน่งรอง", value: member.secondPosition },
              { label: "ฝ่าย", value: member.division },
              { label: "ทีม", value: member.team },
              { label: "สถานะพนักงาน", value: member.employmentStatus },
              { label: "รหัสพนักงาน", value: member.employeeCode },
              { label: "เพศ", value: member.gender },
              { label: "สัญชาติ", value: member.nationality },
              { label: "วันเกิด", value: formatDate(member.birthday) },
              { label: "เริ่มงาน", value: formatDate(member.dateStarted) },
              { label: "โทร", value: member.phone },
              { label: "โทร (สำรอง)", value: member.phone2 },
              { label: "อีเมล", value: member.email },
              { label: "อีเมลงาน", value: member.workEmail },
              {
                label: "LINE",
                value: member.lineUserId ? (
                  <Dot tone="good" label="เชื่อมแล้ว" />
                ) : (
                  <Dot tone="muted" label="ยังไม่เชื่อม — พิมพ์ /link ในกลุ่ม LINE" />
                ),
              },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="โซนรับผิดชอบ" />
        <div className="px-5 pb-5">
          {memberZones.length === 0 ? (
            <p className="text-sm text-ink-3">ยังไม่มีโซนที่รับผิดชอบ</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {memberZones.map((z) => (
                <Pill key={z.id} tone="accent">
                  {z.name} · {z.code}
                </Pill>
              ))}
            </div>
          )}

          {manage && (
            <form
              action={setMemberZones.bind(null, id)}
              className="mt-4 border-t border-line pt-4"
            >
              <div className="grid max-h-72 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto sm:grid-cols-3">
                {allZones.map((z) => (
                  <label
                    key={z.id}
                    className="flex items-center gap-2 text-sm text-ink-2"
                  >
                    <input
                      type="checkbox"
                      name="zoneIds"
                      value={z.id}
                      defaultChecked={assigned.has(z.id)}
                      className="accent-[var(--accent)]"
                    />
                    {z.nameThai ?? z.nameEng}
                  </label>
                ))}
              </div>
              <Button type="submit" variant="secondary" className="mt-3">
                บันทึกโซน
              </Button>
            </form>
          )}
        </div>
      </Card>

      {showPII && (
        <Card>
          <CardHeader title="ข้อมูลส่วนบุคคล (HR)" />
          <div className="px-5 pb-5 space-y-4">
            <DL
              items={[
                { label: "เลขบัตรประชาชน", value: member.idCardNo },
                { label: "ที่อยู่", value: member.address },
                { label: "หมายเหตุ", value: member.remark },
              ]}
              cols={2}
            />
            {(member.emergencyContacts?.length ?? 0) > 0 && (
              <div>
                <div className="pb-1 text-xs text-ink-3">ผู้ติดต่อฉุกเฉิน</div>
                <ul className="space-y-1 text-sm">
                  {member.emergencyContacts!.map((c, i) => (
                    <li key={i}>
                      {c.name}
                      {c.relation && <span className="text-ink-3"> ({c.relation})</span>}
                      {c.phone && <span className="num text-ink-2"> · {c.phone}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(member.agreementFiles?.length ?? 0) > 0 && (
              <div>
                <div className="pb-1 text-xs text-ink-3">เอกสารสัญญา</div>
                <ul className="space-y-1 text-sm">
                  {member.agreementFiles!.map((url, i) => (
                    <li key={i}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-text hover:underline"
                      >
                        ไฟล์ {i + 1}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {(isSelf || manage) && (
        <Card>
          <CardHeader title="รูปโปรไฟล์" />
          <form
            action={uploadAvatar.bind(null, id)}
            className="flex flex-wrap items-end gap-3 px-5 pb-5"
          >
            <Field label="อัปโหลดรูปใหม่ (JPG/PNG/WebP ≤ 5MB)" className="min-w-64">
              <Input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
            </Field>
            <Button type="submit" variant="secondary">
              อัปโหลด
            </Button>
          </form>
        </Card>
      )}

      {isSelf && (
        <Card>
          <CardHeader title="เปลี่ยนรหัสผ่าน" />
          <form
            action={changeOwnPassword}
            className="grid gap-3 px-5 pb-5 sm:grid-cols-3"
          >
            <Field label="รหัสผ่านปัจจุบัน">
              <Input type="password" name="currentPassword" required />
            </Field>
            <Field label="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)">
              <Input type="password" name="newPassword" minLength={8} required />
            </Field>
            <div className="flex items-end">
              <Button type="submit" variant="secondary">
                เปลี่ยนรหัสผ่าน
              </Button>
            </div>
          </form>
        </Card>
      )}

      {manage && balance && (
        <Card>
          <CardHeader title={`สิทธิ์วันลาปี ${year + 543}`} />
          <form
            action={setLeaveAllowance.bind(null, id)}
            className="flex flex-wrap items-end gap-3 px-5 pb-5"
          >
            <input type="hidden" name="year" value={year} />
            <Field label={`ลาป่วย (ใช้ไป ${formatNum(balance.used.sick)})`} className="w-36">
              <Input
                type="number"
                step="0.5"
                min="0"
                name="sickDays"
                defaultValue={balance.allowance?.sickDays ?? ""}
              />
            </Field>
            <Field label={`ลากิจ (ใช้ไป ${formatNum(balance.used.personal)})`} className="w-36">
              <Input
                type="number"
                step="0.5"
                min="0"
                name="personalDays"
                defaultValue={balance.allowance?.personalDays ?? ""}
              />
            </Field>
            <Field label={`พักร้อน (ใช้ไป ${formatNum(balance.used.vacation)})`} className="w-36">
              <Input
                type="number"
                step="0.5"
                min="0"
                name="vacationDays"
                defaultValue={balance.allowance?.vacationDays ?? ""}
              />
            </Field>
            <Button type="submit" variant="secondary">
              บันทึกสิทธิ์วันลา
            </Button>
          </form>
        </Card>
      )}

      {manage && (
        <Card>
          <CardHeader title="จัดการบัญชี" />
          <div className="space-y-5 px-5 pb-5">
            {!isSelf && (
              <form
                action={setMemberRole.bind(null, id)}
                className="flex flex-wrap items-end gap-3"
              >
                <Field label="สิทธิ์การใช้งาน" className="w-48">
                  <Select name="role" defaultValue={member.role}>
                    {roleRows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" variant="secondary">
                  บันทึกสิทธิ์
                </Button>
              </form>
            )}

            <form
              action={resetMemberPassword.bind(null, id)}
              className="flex flex-wrap items-end gap-3"
            >
              <Field label="ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" className="w-64">
                <Input type="password" name="newPassword" minLength={8} required />
              </Field>
              <Button type="submit" variant="secondary">
                รีเซ็ตรหัสผ่าน
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              {member.lineUserId && (
                <form action={clearLineLink.bind(null, id)}>
                  <Button type="submit" variant="secondary">
                    ยกเลิกการเชื่อม LINE
                  </Button>
                </form>
              )}
              {!isSelf &&
                (member.banned ? (
                  <form action={reactivateMember.bind(null, id)}>
                    <Button type="submit" variant="secondary">
                      คืนสถานะพนักงาน
                    </Button>
                  </form>
                ) : (
                  <form
                    action={deactivateMember.bind(null, id)}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <Field label="เหตุผล (ไม่บังคับ)" className="w-64">
                      <Input name="reason" placeholder="เช่น ลาออก" />
                    </Field>
                    <Button type="submit" variant="danger">
                      ระงับบัญชี (พ้นสภาพ)
                    </Button>
                  </form>
                ))}
            </div>
            <p className="text-xs text-ink-3">
              บัญชีที่ถูกระงับจะเข้าสู่ระบบไม่ได้และ session เดิมถูกยกเลิกทันที
              ข้อมูลงานทั้งหมดยังอยู่ครบ
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
