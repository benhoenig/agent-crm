"use client";

/* One-tap state editor — a row of pills where tapping one saves it (Ben,
   2026-09-11: "apply the component and layout from klaichan as well"). Ported
   from Klaichan's components/ui/Edit.tsx PillSelect, restyled onto our tokens.

   WHY IT EXISTS. Changing a listing's สถานะ or a lead's เกรด meant opening the
   edit page — a route change, a form, a save, a route change back — for a
   one-word change that happens several times a call. Only the lead's pipeline
   stage was ever one tap. This is that affordance for the rest.

   IT IS NOT A <select>. The whole set has to be readable without opening
   anything: which grade a listing is at only means something next to the
   grades it is not at, and a collapsed select hides exactly that.

   OPTIMISTIC, DELIBERATELY NOT. The pill does not move until the server
   action resolves, because these writes are scope-checked and CAN come back
   refused (a listing outside your scope, an option archived mid-session). A
   pill that jumped and then jumped back would read as a bug; a spinner for
   150ms reads as a save. */

import { useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Tone } from "./index";

const ACTIVE_TONE: Record<Tone, string> = {
  accent: "bg-accent text-accent-ink",
  good: "bg-good text-surface",
  warn: "bg-warn text-surface",
  bad: "bg-bad text-surface",
  info: "bg-info text-surface",
  muted: "bg-ink-2 text-surface",
};

export function PillSelect({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
}: {
  /** The stored key. May be null — nothing is active then. */
  value: string | null;
  /** Display order comes from the options table; `key` IS the label. */
  options: { key: string; tone?: Tone }[];
  /** Bound server action. Refusals are silent by design — see the note above. */
  onChange: (next: string) => Promise<void>;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-1.5"
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || pending}
            // Re-tapping the active pill is a no-op, not a redundant write.
            onClick={() =>
              !active &&
              startTransition(async () => {
                await onChange(o.key);
              })
            }
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              "disabled:pointer-events-none disabled:opacity-50",
              active
                ? ACTIVE_TONE[o.tone ?? "muted"]
                : "bg-surface-3 text-ink-2 hover:bg-surface-3 hover:text-ink"
            )}
          >
            {o.key}
          </button>
        );
      })}
      {pending && (
        <LoaderCircle size={13} className="animate-spin text-ink-3" />
      )}
    </div>
  );
}
