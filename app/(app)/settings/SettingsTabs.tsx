"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/settings", label: "บัญชีผู้ใช้" },
  { href: "/settings/options", label: "รายการตัวเลือก" },
  { href: "/settings/roles", label: "สิทธิ์การใช้งาน" },
  { href: "/settings/zones", label: "โซน" },
  { href: "/settings/sla", label: "SLA ติดตามงาน" },
  { href: "/settings/reposts", label: "รอบดันประกาศ" },
  { href: "/settings/templates", label: "เทมเพลตโพสต์" },
  { href: "/settings/line", label: "กลุ่ม LINE" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1.5">
      {TABS.map((t) => {
        const active =
          t.href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-accent-soft text-accent-text"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
