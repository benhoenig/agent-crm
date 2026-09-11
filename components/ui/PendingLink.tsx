"use client";

import Link, { useLinkStatus } from "next/link";
import { cn } from "@/lib/cn";

/* ── PendingLink ───────────────────────────────────────────────────
   Pagination changes only the query string, so the router stays on the
   same segment: React keeps the already-mounted Suspense boundary and
   loading.tsx never re-fires. Without this the page would just sit there
   while the next page of rows is fetched.

   The dot always occupies its space (only opacity changes) so nothing
   shifts, and the 150ms delay means a fast response never flashes it —
   the transition reverses before the delay elapses. */
export function PendingLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1.5", className)}>
      {children}
      <PendingDot />
    </Link>
  );
}

function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full bg-current transition-opacity duration-200",
        pending
          ? "animate-pulse opacity-100 delay-150 motion-reduce:animate-none"
          : "opacity-0 delay-0"
      )}
    />
  );
}
