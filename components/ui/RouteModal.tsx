"use client";

/* The overlay half of a route modal (Ben, 2026-08-29: "add lead and add
   listing button to open up a modal … rather than changing page").

   IT IS A ROUTE, NOT A PIECE OF STATE. + เพิ่มทรัพย์ still links to
   /listings/new; app/(app)/@modal intercepts that link and renders the same
   server component in here instead, over the list you were reading. That
   buys three things a useState modal cannot:

     · the form stays a SERVER component — it fetches zones, agents, projects,
       stations and the picklists itself, and only when the modal is opened.
       A client modal would have to have all of that fetched and rendered by
       the list page on every load, opened or not.
     · /listings/new still works as a page. Refresh, a shared link, or the AI
       tray's "เปิดร่างในฟอร์ม" from a cold load all get the full page.
     · Back closes it, Forward reopens it, because it IS history.

   The trade is that the URL changes to /listings/new while the modal is open.
   That is the mechanism, not a leak: the page underneath never unmounts.

   THE BACKDROP DOES NOT CLOSE. Everywhere else in this app a click-away
   dismisses (TonePicker, ConfirmDelete, the task sheet) because the worst
   case is reopening a menu. Here the worst case is a half-typed listing, so
   closing takes the ✕, Esc, or ยกเลิก — each of them a thing you meant. */

import { useCallback, useId, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useDismissOnEscape } from "./useDismissOnEscape";
import { Button } from "./index";

export function RouteModal({
  title,
  sub,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const titleId = useId();
  // back(), not push(list): the modal was pushed onto history by the link
  // that opened it, so unwinding is what returns you to the page you were on
  // — which is not always the list (the AI tray opens this from anywhere).
  const close = useCallback(() => router.back(), [router]);

  // Topmost-wins: with the editor modal open over the drawer, one Esc must
  // pop one history entry, not two. See useDismissOnEscape.
  useDismissOnEscape(close);

  return (
    // z-[90] clears the AI tray (z-50), the task sheet (z-70) and the record
    // drawer (z-80) — a modal a floating tray can sit on top of is worse than
    // no modal, and the editor opens OVER the drawer, not beside it. Stated
    // rather than left to DOM order, which happened to be right and would
    // stop being right the first time the two are rendered in either order.
    //
    // Its backdrop covers the drawer, so the drawer's own click-away cannot
    // fire while this is open. Esc is handled by useDismissOnEscape, which
    // gives the keypress to this modal alone.
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-auto flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-card border border-line-strong bg-bg shadow-xl"
      >
        {/* Sticky by being outside the scroller: the form is long enough that
            a header scrolled away would leave no way out but Esc. */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line bg-surface px-5 py-3.5">
          <div>
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            {sub && <p className="pt-0.5 text-sm text-ink-3">{sub}</p>}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="ปิด"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-ctl border border-line text-ink-2 transition-colors hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** The form footer's ยกเลิก when the form is inside a RouteModal. Same job as
 *  the ✕ — dismiss without navigating anywhere — but at the bottom of a long
 *  form, where the header is metres away. */
export function ModalCancelButton() {
  const router = useRouter();
  return (
    <Button type="button" variant="ghost" onClick={() => router.back()}>
      ยกเลิก
    </Button>
  );
}
