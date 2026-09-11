"use client";

/* The right-hand slide-over a record opens in (Ben, 2026-08-29: "make the
   whole page as a drawer like Klaichan instead"). Ported from that project's
   ListingSheet, which is the only way a record is ever seen there — there is
   no /listings/[id] page in Klaichan at all, and now there is none here.

   SAME MECHANISM AS RouteModal, opposite dismissal. A row still links to
   /listings/<id>; app/(app)/@modal intercepts the click and renders the
   record in here, so the grid underneath keeps its scroll position, its sort
   and its column layout instead of being torn down and rebuilt. On a hard
   load the interception does not happen and the real route renders the list
   with this drawer already open over it, so a pasted link still lands
   somewhere that makes sense.

   THE BACKDROP DOES CLOSE, unlike RouteModal's. That one guards a half-typed
   listing; this is a thing you opened to READ, and the click-away is how
   every other dismissible surface in the app behaves (TonePicker,
   ConfirmDelete, the task sheet). The small forms inside it — a portal URL, a
   follow stamp — each save on their own button, so nothing is lost.

   36rem, not Klaichan's 27.5rem. Theirs holds a price, a spec grid and an
   owner; ours also has to hold the portal editor's pasted announcement URLs
   and a four-across media grid, and those stop working before 30rem. */

import { useCallback, useId, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useDismissOnEscape } from "./useDismissOnEscape";

export function RouteDrawer({
  title,
  sub,
  badges,
  actions,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  /** Status dots and pills, on their own line above the title. */
  badges?: ReactNode;
  /** Buttons for the header's right edge, left of the ✕. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const titleId = useId();
  const close = useCallback(() => router.back(), [router]);

  // Topmost-wins: with the editor modal open over the drawer, one Esc must
  // pop one history entry, not two. See useDismissOnEscape.
  useDismissOnEscape(close);

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[80] flex justify-end bg-black/45 backdrop-blur-[2px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // stopPropagation, or every click inside the record would dismiss it.
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[36rem] flex-col border-l border-line-strong bg-bg shadow-xl"
      >
        {/* Outside the scroller so it stays put: these records run long, and a
            header that scrolls away leaves Esc as the only way out. */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line bg-surface px-5 py-3.5">
          <div className="min-w-0">
            {badges && (
              <div className="flex flex-wrap items-center gap-2 pb-1.5">
                {badges}
              </div>
            )}
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            {sub && <p className="num pt-0.5 text-sm text-ink-3">{sub}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={close}
              aria-label="ปิด"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-ctl border border-line text-ink-2 transition-colors hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
