"use client";

// The position strip. Rendered only for people with more than one seat to
// choose between; everyone else never learns it exists.
//
// IT MEANS TWO DIFFERENT THINGS AND SAYS SO (Ben, 2026-08-29). For an admin it
// is still ทำงานเป็น — the seat narrows their permissions app-wide, so it sits
// under the Topbar on every page and switching it changes what the app will
// let them do. For everyone else it now only picks WHICH DASHBOARD they read;
// their permissions are the merge of every role they hold and the strip cannot
// touch them. Calling that "ทำงานเป็น" would promise a change the click no
// longer makes, so the label changes with the meaning and the strip renders
// inside the dashboard rather than above every page. See lib/auth/position.ts.

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setPosition } from "@/lib/auth/position-actions";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

// Shape mirrors PositionChoice in lib/auth/position.ts — declared here rather
// than imported so a client bundle never reaches into a next/headers module.
type Choice = { id: string; name: string; granted: boolean };

export function PositionNav({
  active,
  choices,
  narrowing,
}: {
  active: string;
  choices: Choice[];
  /** True when the choice narrows permissions everywhere — admins only. See
      PositionState.narrowing. Drives the label and, at the call sites, where
      this renders at all. */
  narrowing: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(id: string) {
    if (id === active || pending) return;
    startTransition(async () => {
      await setPosition(id);
      // The cookie is the whole state: sidebar, permission matrix and every
      // query scope re-derive from it, so one refresh updates the lot. A page
      // the new position may not open sends itself home (requirePermission).
      router.refresh();
    });
  }

  // Borrowed = an admin inspecting a position they do not hold. Worth its own
  // signal: what they are seeing is a preview, not their own work.
  const borrowed = choices.some((c) => c.id === active && !c.granted);

  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2.5 border-line px-6 transition-colors",
        // Full-bleed under the Topbar for an admin; a rounded card when it
        // sits inside the dashboard among the other cards.
        narrowing ? "border-b" : "rounded-card border bg-surface",
        borrowed ? "bg-amber-500/[0.07]" : "bg-surface"
      )}
    >
      <span className="shrink-0 text-[10px] font-semibold tracking-[0.14em] text-ink-3 uppercase">
        {narrowing ? "ทำงานเป็น" : "มุมมองแดชบอร์ด"}
      </span>
      <div
        role="group"
        aria-label={narrowing ? "ตำแหน่งที่ใช้งาน" : "มุมมองแดชบอร์ด"}
        className="flex min-w-0 gap-1 overflow-x-auto"
      >
        {choices.map((c) => {
          const on = c.id === active;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              disabled={pending}
              aria-pressed={on}
              title={
                c.granted
                  ? undefined
                  : "ตำแหน่งที่คุณไม่ได้ถือ — ดูมุมมองเท่านั้น"
              }
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors disabled:opacity-60",
                on &&
                  c.granted &&
                  "bg-accent font-semibold text-accent-ink shadow-glow",
                on &&
                  !c.granted &&
                  "border border-amber-500/70 bg-amber-500/15 font-semibold text-ink",
                !on && "text-ink-2 hover:bg-surface-2 hover:text-ink"
              )}
            >
              {c.granted ? null : <Icon name="eye" size={13} />}
              {c.name}
            </button>
          );
        })}
      </div>
      {borrowed ? (
        <span className="ml-auto hidden shrink-0 text-[11px] text-ink-3 sm:block">
          กำลังดูมุมมองของตำแหน่งที่คุณไม่ได้ถือ
        </span>
      ) : null}
    </div>
  );
}
