"use client";

// TEMPORARY DEV TOOL: role simulator — see lib/auth/simulate.ts for the
// removal checklist. Rendered in the Topbar for admins only (real role).

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setSimulatedRole } from "@/lib/auth/simulate-actions";
import { cn } from "@/lib/cn";

export function RoleSimulator({
  active,
  realRole,
  roles,
}: {
  /** Currently simulated role id, or null when viewing as the real role. */
  active: string | null;
  realRole: string;
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(roleId: string) {
    startTransition(async () => {
      await setSimulatedRole(roleId === realRole ? null : roleId);
      router.refresh();
    });
  }

  return (
    <div
      title="จำลองมุมมองตามบทบาท (เครื่องมือชั่วคราว — เฉพาะแอดมิน)"
      className={cn(
        "flex h-9 items-center gap-1 rounded-full border pr-1 pl-3 text-sm transition-colors",
        active
          ? "border-amber-500/70 bg-amber-500/10 text-ink"
          : "border-line bg-surface-2 text-ink-2"
      )}
    >
      <span className="text-[10px] font-semibold tracking-wide text-ink-3 uppercase">
        ดูเป็น
      </span>
      <select
        value={active ?? realRole}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        aria-label="จำลองมุมมองตามบทบาท"
        className="cursor-pointer bg-transparent pr-1 text-sm outline-none disabled:opacity-50"
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.id === realRole ? " (จริง)" : ""}
          </option>
        ))}
      </select>
      {active ? (
        <button
          onClick={() => change(realRole)}
          disabled={pending}
          aria-label="เลิกจำลองมุมมอง"
          title="เลิกจำลองมุมมอง"
          className="flex size-7 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
