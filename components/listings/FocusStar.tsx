"use client";

/* The โฟกัสเจ้าของ star — "I am working this listing".

   OPTIMISTIC, UNLIKE PillSelect. The sibling control in the same Manage card
   deliberately waits for the server, because a status write is scope-checked
   and can be refused, and a pill that snapped to a value the server rejected
   would be lying. This one is different in kind: you can only ever star a
   listing you are already looking at inside your own scope, so the refusal
   case is a stale tab rather than a normal outcome. Waiting ~300ms to shade a
   star you tapped is the wrong trade for a control people use in bursts.

   If the server does refuse (null — the listing moved out of your book while
   the page was open) the star rolls back to where it was and says so once. */

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleListingFocus } from "@/app/(app)/listings/actions";

export function FocusStar({
  listingId,
  initial,
  variant = "button",
}: {
  listingId: string;
  /** Whether it is on the viewer's board, read on the server. */
  initial: boolean;
  /** `button` — the labelled control in the listing drawer's Manage card.
      `icon` — the bare star used in a dense row on the focus board. */
  variant?: "button" | "icon";
}) {
  const [on, setOn] = useState(initial);
  const [stale, setStale] = useState(false);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    setStale(false);
    start(async () => {
      const settled = await toggleListingFocus(listingId).catch(() => null);
      if (settled === null) {
        setOn(!next); // refused or gone — put it back
        setStale(true);
        return;
      }
      setOn(settled);
    });
  }

  const label = on ? "เอาออกจากโฟกัสเจ้าของ" : "เพิ่มเข้าโฟกัสเจ้าของ";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={on}
        title={label}
        className={`shrink-0 rounded-full p-1 transition-colors ${
          on ? "text-warn" : "text-ink-3 hover:text-ink-2"
        } ${pending ? "opacity-60" : ""}`}
      >
        <Star size={14} fill={on ? "currentColor" : "none"} />
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        className={`flex w-full items-center justify-center gap-1.5 rounded-ctl border px-3 py-1.5 text-[0.8rem] font-semibold transition-colors ${
          on
            ? "border-warn/40 bg-warn-soft text-warn"
            : "border-line text-ink-2 hover:bg-surface-2"
        } ${pending ? "opacity-70" : ""}`}
      >
        <Star size={14} fill={on ? "currentColor" : "none"} />
        {on ? "อยู่ในโฟกัสเจ้าของ" : "เพิ่มเข้าโฟกัสเจ้าของ"}
      </button>
      {stale && (
        <p className="pt-1 text-[0.7rem] text-warn">
          ทรัพย์นี้ไม่ได้อยู่ในความดูแลของคุณแล้ว — รีเฟรชหน้านี้
        </p>
      )}
    </div>
  );
}
