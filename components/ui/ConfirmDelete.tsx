"use client";

// Impact-aware confirm popover for destructive actions. Every destructive
// button in Settings goes through this: the popover names the thing, states
// the real impact (usage counts), and only then offers the action.

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

export function ConfirmDelete({
  onConfirm,
  confirmLabel,
  warning,
  actionLabel = "ลบ",
  trigger,
  triggerAriaLabel,
  className,
}: {
  onConfirm: () => void | Promise<unknown>;
  /** Headline of the popover, e.g. `ลบ "บ้านเดี่ยว"?` */
  confirmLabel: string;
  /** Impact line — what this touches (usage counts, downstream effects). */
  warning?: React.ReactNode;
  /** Text on the destructive button (ลบ / ซ่อน / ถอดออก …). */
  actionLabel?: string;
  /** Custom trigger content; defaults to a small ✕ icon button. */
  trigger?: React.ReactNode;
  triggerAriaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function confirm() {
    startTransition(async () => {
      await onConfirm();
      setOpen(false);
    });
  }

  return (
    <div
      className={cn("relative", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={triggerAriaLabel ?? actionLabel}
        title={triggerAriaLabel ?? actionLabel}
        aria-expanded={open}
        className={
          trigger
            ? "block"
            : "flex size-7 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad"
        }
      >
        {trigger ?? <X size={14} />}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute top-[calc(100%+4px)] right-0 z-50 w-72 rounded-card border border-line bg-surface-2 p-3.5 shadow-card">
            <div className="text-sm font-medium">{confirmLabel}</div>
            {warning ? (
              <p className="pt-1.5 text-xs leading-relaxed text-ink-3">
                {warning}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                variant="danger"
                className="px-3 py-1.5 text-xs"
                onClick={confirm}
                disabled={pending}
              >
                {pending ? "กำลังทำ…" : actionLabel}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
