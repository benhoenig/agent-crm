"use client";

/* Esc dismisses the TOPMOST overlay, and only that one.

   Needed the moment two overlays could be open at once (2026-09-11: the edit
   modal renders over the record drawer). Both used to own a document keydown
   listener calling router.back(); with both mounted, one Esc ran both, popped
   two history entries and dropped the user on the list instead of back on the
   record they were editing.

   ONE listener for the whole app, not one per overlay — that is the actual
   fix. A per-overlay listener that checks "am I on top?" still fires N times
   per keypress, and N-1 of those would find a handler to run.

   Mount order is the stack order: React runs sibling effects in document
   order, so an overlay rendered after another sits above it here exactly as
   it does on screen. */

import { useEffect } from "react";

type Entry = { close: () => void };

const stack: Entry[] = [];
let bound = false;

function onKey(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  const top = stack[stack.length - 1];
  if (!top) return;
  // Stop anything further out (a parent overlay's own handler, a page-level
  // shortcut) from treating the same keypress as its own dismissal.
  e.stopPropagation();
  top.close();
}

/** Register `close` as this overlay's Esc handler while it is mounted. */
export function useDismissOnEscape(close: () => void) {
  useEffect(() => {
    const entry: Entry = { close };
    stack.push(entry);
    if (!bound) {
      document.addEventListener("keydown", onKey);
      bound = true;
    }
    return () => {
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
      if (stack.length === 0 && bound) {
        document.removeEventListener("keydown", onKey);
        bound = false;
      }
    };
  }, [close]);
}
