"use client";

import Link from "next/link";
import { APP_NAME, BRAND } from "@/lib/brand";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NAV } from "@/lib/nav";
import type { RolePermissions } from "@/lib/auth/roles";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

// The reference's signature move: the active item is a full lime pill.
// Nav items with a `perm` key are hidden from roles that lack it — display
// only; each gated page re-checks with requirePermission server-side.
/** Build date as "20 ส.ค. 69 22:44" (Bangkok) — stamped at build time. */
const buildDate = (() => {
  const raw = process.env.NEXT_PUBLIC_BUILT_AT;
  if (!raw) return "dev";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "dev";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(d);
})();

export function Sidebar({ perms }: { perms: RolePermissions }) {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K focuses the box — the shortcut the kbd hint has always shown.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.perm || perms[item.perm]),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      {/* brand + user */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <div className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-glow">
          <Icon name="home" size={18} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide">{BRAND}</div>
          <div className="text-xs text-ink-3">CRM</div>
        </div>
      </div>

      {/* search — submits to /search (scoped across listings/leads/contacts/projects) */}
      <form action="/search" className="px-4 pb-2">
        <label className="flex items-center gap-2 rounded-ctl border border-line bg-surface-2 px-3 py-2 text-ink-3 focus-within:border-line-strong">
          <Icon name="search" size={15} />
          <input
            ref={searchRef}
            name="q"
            type="search"
            autoComplete="off"
            placeholder="ค้นหา…"
            aria-label="ค้นหา"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="num rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-3">
            ⌘K
          </kbd>
        </label>
      </form>

      {/* nav groups */}
      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        {groups.map((group) => (
          <div key={group.title} className="pt-5">
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-accent font-semibold text-accent-ink shadow-glow"
                          : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                      )}
                    >
                      <Icon name={item.icon} size={17} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-5 py-4 text-[11px] text-ink-3">
        <div>{APP_NAME} · pre-release</div>
        <div className="num pt-0.5" title={`built ${process.env.NEXT_PUBLIC_BUILT_AT ?? ""}`}>
          build {process.env.NEXT_PUBLIC_BUILD_REV ?? "dev"} · {buildDate}
        </div>
      </div>
    </aside>
  );
}
