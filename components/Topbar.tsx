"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV } from "@/lib/nav";
import { Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authClient } from "@/lib/auth/client";
import { Avatar } from "@/components/ui/Avatar";
import { BRAND } from "@/lib/brand";

function pageLabel(pathname: string) {
  if (pathname.startsWith("/notifications")) return "การแจ้งเตือน";
  for (const g of NAV)
    for (const item of g.items) {
      if (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))
        return item.label;
    }
  return BRAND;
}

export function Topbar({
  user,
  unreadCount,
}: {
  /** roleLabel is the WORKING POSITION, not every role granted — switching
      seats is the PositionNav strip's job, one row below. */
  user: { name: string; roleLabel: string; image: string | null };
  unreadCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-surface px-6">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-ink-3">{BRAND} /</span>
        <span className="font-semibold">{pageLabel(pathname)}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <Link
          href="/notifications"
          aria-label="การแจ้งเตือน"
          className="relative flex size-9 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
        >
          <Icon name="bell" size={16} />
          {unreadCount > 0 && (
            <span className="num absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
        <div className="ml-1 flex items-center gap-2.5 rounded-full border border-line bg-surface-2 py-1 pr-1.5 pl-1">
          <Avatar image={user.image} name={user.name} size="size-7 text-xs" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm">{user.name}</span>
            <span className="text-[0.65rem] text-ink-3">{user.roleLabel}</span>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="ออกจากระบบ"
            title="ออกจากระบบ"
            className="ml-1 flex size-7 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Icon name="logout" size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
