import Link from "next/link";
import {
  Card,
  Dot,
  EmptyState,
  LinkedRow,
  PageHeader,
  Pill,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { getSalesRoster, listTeam } from "@/lib/repo/team";
import { MyTeamPanel } from "@/components/team/MyTeamPanel";
import { roleNames } from "@/lib/repo/roles";
import { toneMap } from "@/lib/repo/options";
import { toneFor } from "@/lib/labels";
import { Avatar } from "@/components/ui/Avatar";
import type { Tone } from "@/components/ui";

export const dynamic = "force-dynamic";

const ROLE_TONE: Record<string, Tone> = {
  admin: "accent",
  manager: "info",
  sales: "good",
  support: "muted",
};

export default async function TeamPage() {
  const viewer = await getViewer();
  // ทีมของฉัน is a CAPABILITY, not a role: rendered wherever targetsSet is
  // held, the same way the intake queue follows intakeAssign.
  const [members, roleLabel, statusTones, roster] = await Promise.all([
    listTeam(),
    roleNames(),
    toneMap("employment_status"),
    viewer.perms.targetsSet ? getSalesRoster(viewer.userId) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="พนักงาน"
        sub="ทำเนียบทีม — ตำแหน่ง โซนรับผิดชอบ และช่องทางติดต่อ (เพิ่มบัญชีใหม่ได้ที่ ตั้งค่า)"
      />

      {viewer.perms.targetsSet && (
        <MyTeamPanel
          roster={roster}
          viewerId={viewer.userId}
          viewerName={viewer.name}
        />
      )}

      <Card>
        {members.length === 0 ? (
          <EmptyState title="ยังไม่มีพนักงานในระบบ" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>พนักงาน</Th>
                <Th>ตำแหน่ง</Th>
                <Th>ฝ่าย / ทีม</Th>
                <Th>สิทธิ์</Th>
                <Th>โซน</Th>
                <Th>โทร</Th>
                <Th>สถานะ</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <LinkedRow key={m.id} href={`/team/${m.id}`}>
                  <Td>
                    <Link href={`/team/${m.id}`} className="flex items-center gap-3">
                      <Avatar image={m.image} name={m.nickname ?? m.name} />
                      <div>
                        <div className="font-medium text-accent-text hover:underline">
                          {m.name}
                          {m.nickname && m.nickname !== m.name && (
                            <span className="text-ink-3"> ({m.nickname})</span>
                          )}
                        </div>
                        <div className="pt-0.5 text-xs text-ink-3">{m.email}</div>
                      </div>
                    </Link>
                  </Td>
                  <Td className="text-ink-2">{m.position ?? "—"}</Td>
                  <Td className="text-ink-2">
                    {[m.division, m.team].filter(Boolean).join(" / ") || "—"}
                  </Td>
                  <Td>
                    <Pill tone={ROLE_TONE[m.role] ?? "muted"}>
                      {roleLabel[m.role] ?? m.role}
                    </Pill>
                  </Td>
                  <Td>
                    {m.zones.length === 0 ? (
                      <span className="text-ink-3">—</span>
                    ) : (
                      <div className="flex max-w-64 flex-wrap gap-1">
                        {m.zones.slice(0, 4).map((z) => (
                          <Pill key={z.id}>{z.name}</Pill>
                        ))}
                        {m.zones.length > 4 && (
                          <Pill className="num">+{m.zones.length - 4}</Pill>
                        )}
                      </div>
                    )}
                  </Td>
                  <Td className="num whitespace-nowrap text-ink-2">
                    {m.phone ?? "—"}
                  </Td>
                  <Td>
                    {m.banned ? (
                      <Dot tone="bad" label="พ้นสภาพ" />
                    ) : (
                      // Tone follows the option's own colour, not a hardcoded
                      // "good": employment_status is a catalog now, and a
                      // member marked Inactive was showing a GREEN dot next to
                      // the word Inactive.
                      <Dot
                        tone={toneFor(statusTones, m.employmentStatus)}
                        label={m.employmentStatus ?? "ทำงานอยู่"}
                      />
                    )}
                  </Td>
                </LinkedRow>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
