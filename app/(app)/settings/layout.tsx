import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { SettingsTabs } from "./SettingsTabs";

// One admin gate for every /settings section.
export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermission((p) => p.settings);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="ตั้งค่า"
        sub="บัญชีผู้ใช้ · รายการตัวเลือก · โซน · กติกา SLA · กลุ่ม LINE"
      />
      <SettingsTabs />
      {children}
    </div>
  );
}
