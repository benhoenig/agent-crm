"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

/* ── LinkedRow ─────────────────────────────────────────────────────
   List rows highlight on hover, so the whole row has to be clickable —
   not just the name in the first cell.

   The row still contains a real <Link> to the same href (keyboard focus,
   ⌘-click, prefetch, "copy link address"); this only widens the hit area
   to the rest of the row. Two guards keep that from stealing clicks that
   belong to something else:
     • a click that landed on another link/button/field (the tel: link on
       /contacts, the "ตามแล้ววันนี้" submit on /today) is left alone;
     • a click that ends a text selection is left alone, so cell values
       — LINE ID, email, ราคา — stay copyable. */
export function LinkedRow({
  href,
  className,
  children,
  ...props
}: { href: string } & React.HTMLAttributes<HTMLTableRowElement>) {
  const router = useRouter();

  function ownsClick(e: React.MouseEvent<HTMLTableRowElement>) {
    const el = e.target as HTMLElement | null;
    if (el?.closest("a, button, input, select, textarea, label, [role='button']")) {
      return false;
    }
    return !window.getSelection()?.toString();
  }

  return (
    <tr
      className={cn(
        "cursor-pointer transition-colors hover:bg-surface-3",
        className
      )}
      onClick={(e) => {
        if (!ownsClick(e)) return;
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
        else router.push(href);
      }}
      onAuxClick={(e) => {
        // middle-click → new tab, same as a real anchor
        if (e.button !== 1 || !ownsClick(e)) return;
        e.preventDefault();
        window.open(href, "_blank", "noopener");
      }}
      {...props}
    >
      {children}
    </tr>
  );
}
