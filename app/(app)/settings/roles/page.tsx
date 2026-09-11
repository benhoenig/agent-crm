import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui";
import { count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userRoles } from "@/lib/db/schema";
import { allRoles } from "@/lib/repo/roles";
import { param, type Search } from "@/lib/search-params";
import { formatNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PERM_TOGGLE_KEYS, grantCount } from "@/lib/auth/roles";
import { AddRoleForm, RoleEditor } from "@/components/settings/RolesManager";

export const dynamic = "force-dynamic";

async function memberCounts(): Promise<Record<string, number>> {
  // counts the GRANT set — someone holding two roles counts under both
  const rows = await getDb()
    .select({ role: userRoles.roleId, n: count() })
    .from(userRoles)
    .groupBy(userRoles.roleId);
  return Object.fromEntries(rows.map((r) => [r.role, r.n]));
}

export default async function RolesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const [roleRows, members] = await Promise.all([allRoles(), memberCounts()]);

  const selectedId = param(sp, "role");
  const selected =
    roleRows.find((r) => r.id === selectedId) ?? roleRows[0];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[250px_1fr]">
      {/* master list — one row per role, summary line under the name */}
      <Card className="self-start">
        <nav className="p-2">
          {roleRows.map((r) => {
            const active = r.id === selected?.id;
            return (
              <Link
                key={r.id}
                href={`/settings/roles?role=${r.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-ctl px-3 py-2 transition-colors",
                  active
                    ? "bg-accent-soft"
                    : "hover:bg-surface-2"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm",
                      active ? "font-semibold text-accent-text" : "text-ink"
                    )}
                  >
                    {r.name}
                  </span>
                  <span className="num block pt-0.5 text-xs text-ink-3">
                    สมาชิก {formatNum(members[r.id] ?? 0)} · สิทธิ์{" "}
                    {grantCount(r.perms)}/{PERM_TOGGLE_KEYS.length}
                  </span>
                </span>
                {r.id === "superadmin" ? (
                  <Lock size={13} className="shrink-0 text-ink-3" />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <AddRoleForm roles={roleRows.map((r) => ({ id: r.id, name: r.name }))} />
      </Card>

      {/* detail — the auto-saving editor for the selected role */}
      {selected ? (
        <RoleEditor
          key={selected.id}
          role={{
            id: selected.id,
            name: selected.name,
            description: selected.description,
            system: selected.system,
            perms: selected.perms,
            members: members[selected.id] ?? 0,
          }}
        />
      ) : null}
    </div>
  );
}
