import { Card, CardHeader, type Tone } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { listAccounts } from "@/lib/repo/team";
import { allRoles } from "@/lib/repo/roles";
import { optionsFor, roleKeys } from "@/lib/repo/options";
import { AccountsManager } from "@/components/settings/AccountsManager";

export const dynamic = "force-dynamic";

export default async function SettingsAccountsPage() {
  const [viewer, accounts, roleRows, statusRows, departed] = await Promise.all([
    getViewer(),
    listAccounts(),
    allRoles(),
    optionsFor("employment_status"),
    roleKeys("employment_status", "departed"),
  ]);

  const active = accounts.filter((a) => !a.banned).length;

  return (
    <Card>
      <CardHeader
        title="บัญชีผู้ใช้"
        action={
          <span className="text-xs text-ink-3">
            <span className="num">{active}</span> ใช้งาน
            {accounts.length > active ? (
              <>
                {" · "}
                <span className="num">{accounts.length - active}</span> ระงับ
              </>
            ) : null}
          </span>
        }
      />
      <p className="px-5 pb-3 text-xs leading-relaxed text-ink-3">
        คลิกแถวเพื่อแก้ไข — รูปโปรไฟล์ ชื่อ ชื่อเล่น สิทธิ์ และรหัสผ่าน (บันทึกอัตโนมัติ) ·
        อีเมลคือชื่อผู้ใช้สำหรับเข้าระบบ เปลี่ยนไม่ได้ ·
        ระงับบัญชีแล้วเข้าระบบไม่ได้ทันที <b>แต่งานที่ถืออยู่ไม่ได้ย้ายให้ใครเอง</b>
      </p>
      <AccountsManager
        accounts={accounts}
        roles={roleRows.map((r) => ({ id: r.id, name: r.name }))}
        statuses={statusRows.map((o) => ({
          key: o.key,
          tone: (o.tone as Tone | null) ?? null,
        }))}
        departed={departed}
        viewerId={viewer.userId}
        canManage={viewer.perms.teamManage}
      />
    </Card>
  );
}
