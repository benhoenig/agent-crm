// Segmented tab strip built from LINKS, not client state.
//
// Every list surface in this app keeps its state in the URL (filters, page),
// so a tab that lived in useState would be the one thing you could not
// bookmark, share, or land on from a redirect — and /deals + /pipeline both
// now redirect INTO a tab. Links also keep these pages server-rendered.

import Link from "next/link";
import { cn } from "@/lib/cn";

export type TabItem = { href: string; label: string; active: boolean };

export function TabNav({
  items,
  className,
}: {
  items: TabItem[];
  className?: string;
}) {
  return (
    <nav
      aria-label="มุมมอง"
      className={cn("flex gap-1 rounded-ctl border border-line bg-surface-3 p-1", className)}
    >
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "rounded-ctl px-3 py-1.5 text-sm transition-colors",
            t.active
              ? "bg-surface-2 font-semibold text-ink shadow-card"
              : "text-ink-3 hover:text-ink"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
