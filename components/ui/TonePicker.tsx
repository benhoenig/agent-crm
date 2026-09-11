"use client";

// Swatch popover for an option's display tone — replaces the old <select> of
// color names. `null` = automatic (labels.ts derives a tone from the key).

import * as React from "react";
import type { Tone } from "@/components/ui";
import { cn } from "@/lib/cn";

const SWATCH_BG: Record<Tone, string> = {
  accent: "bg-accent",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  muted: "bg-ink-3",
};

const CHOICES: { value: Tone | null; label: string }[] = [
  { value: null, label: "สีอัตโนมัติ" },
  { value: "muted", label: "เทา" },
  { value: "info", label: "ฟ้า" },
  { value: "good", label: "เขียว" },
  { value: "warn", label: "เหลือง" },
  { value: "bad", label: "แดง" },
  { value: "accent", label: "เน้น (Accent)" },
];

/** The color circle itself; auto (null) renders as an outlined slash. */
function Swatch({ tone }: { tone: Tone | null }) {
  if (tone) return <span className={cn("size-3.5 rounded-full", SWATCH_BG[tone])} />;
  return (
    <span className="relative size-3.5 rounded-full border border-ink-3">
      <span className="absolute top-1/2 left-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink-3" />
    </span>
  );
}

export function TonePicker({
  value,
  onChange,
  disabled,
}: {
  value: Tone | null;
  onChange: (tone: Tone | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const current = CHOICES.find((c) => c.value === value) ?? CHOICES[0];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label={`สี: ${current.label}`}
        title={current.label}
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-ctl border border-line bg-surface-2 transition-colors hover:border-line-strong disabled:opacity-50"
      >
        <Swatch tone={value} />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute top-[calc(100%+4px)] left-0 z-50 flex gap-1 rounded-card border border-line bg-surface-2 p-1.5 shadow-card">
            {CHOICES.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => {
                  onChange(c.value);
                  setOpen(false);
                }}
                aria-label={c.label}
                title={c.label}
                className={cn(
                  "grid size-8 place-items-center rounded-ctl border transition-colors",
                  c.value === value
                    ? "border-accent bg-surface-3"
                    : "border-transparent hover:bg-surface-3"
                )}
              >
                <Swatch tone={c.value} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
