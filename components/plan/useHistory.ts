"use client";

/* The undo/redo stack for the plan column.

   DELIBERATELY GENERIC AND DELIBERATELY DUMB. It knows nothing about tasks —
   it holds labelled pairs of thunks and runs them in the right order. Every
   decision about WHAT is undoable lives in usePlanner, next to the mutation
   it inverts, because that is the only place with the before-state in hand.

   WHY PAIRS OF THUNKS RATHER THAN STATE SNAPSHOTS. Snapshotting the whole
   planner before every keystroke is simpler to write and wrong in the place
   that matters: restoring a snapshot locally still leaves the SERVER holding
   the new value, so undo would need to diff two snapshots and work out which
   writes to send. An explicit inverse already knows. It also forces the
   question "what is the inverse of this?" to be answered per operation, which
   is what keeps the un-invertible ones (a logged follow-up) off the stack
   instead of silently half-working.

   EVERY ENTRY CARRIES A LABEL, and the button shows it. An undo button whose
   effect you cannot predict is worse than no undo button — particularly here,
   where some actions never make it onto the stack, so "the last thing I did"
   and "the last undoable thing I did" are not always the same. Naming the
   target makes that visible instead of surprising.

   THE STACK IS IN MEMORY AND PER SESSION. A reload clears it, which is
   correct: this is a shared database, and an undo offered ten minutes and one
   page-load later is an invitation to overwrite someone else's work with a
   value the user has long forgotten choosing. */

import { useCallback, useEffect, useReducer, useRef } from "react";

export interface HistoryEntry {
  /** Shown on the undo button, e.g. `ลบงาน "โทรหาคุณเอ"`. Written as the
      ACTION THAT HAPPENED, not as the reversal — the button already says
      ย้อนกลับ, and "ย้อนกลับ: กู้คืนงาน" reads as a double negative. */
  label: string;
  /** Put the world back. Applies local state AND the server write. */
  undo: () => void;
  /** Do it again. */
  redo: () => void;
}

const LIMIT = 50;

export interface History {
  push: (entry: HistoryEntry) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** What ↩ would reverse, for the button's label. Null when empty. */
  undoLabel: string | null;
  redoLabel: string | null;
  /** Drop every entry that mentions a given key — used when an action makes
      earlier entries un-runnable (a promoted task whose follow-up has since
      been logged cannot be un-promoted). */
  forget: (predicate: (entry: HistoryEntry) => boolean) => void;
  clear: () => void;
}

/** Entries may carry arbitrary extra fields; `forget` matches on them. */
export type TaggedEntry = HistoryEntry & { taskId?: string };

/* The stacks live in REFS, not state, and the component is re-rendered by an
   explicit bump.

   Running `entry.undo()` inside a `setState` updater would fire it twice
   under StrictMode's double-invoked updaters — two deletes, two restores, a
   task resurrected then removed again. Updaters must be pure. Refs let the
   stack move and the side effect run in ordinary event-handler code, where
   they belong, and the bump keeps canUndo/labels honest in the render. */
export function useHistory(): History {
  const past = useRef<TaggedEntry[]>([]);
  const future = useRef<TaggedEntry[]>([]);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const push = useCallback((entry: HistoryEntry) => {
    // Any new action invalidates the redo branch — standard, and the only
    // sane reading: you cannot redo a future you have just diverged from.
    future.current = [];
    past.current = [...past.current, entry].slice(-LIMIT);
    bump();
  }, []);

  const undo = useCallback(() => {
    const entry = past.current[past.current.length - 1];
    if (!entry) return;
    past.current = past.current.slice(0, -1);
    future.current = [entry, ...future.current];
    bump();
    entry.undo();
  }, []);

  const redo = useCallback(() => {
    const [entry, ...rest] = future.current;
    if (!entry) return;
    future.current = rest;
    past.current = [...past.current, entry].slice(-LIMIT);
    bump();
    entry.redo();
  }, []);

  const forget = useCallback((predicate: (e: HistoryEntry) => boolean) => {
    past.current = past.current.filter((e) => !predicate(e));
    future.current = future.current.filter((e) => !predicate(e));
    bump();
  }, []);

  const clear = useCallback(() => {
    past.current = [];
    future.current = [];
    bump();
  }, []);

  /* GETTERS, not captured values.

     The stacks live in refs, so a plain `canUndo: past.current.length > 0`
     would freeze at whatever was true when this object was built — correct
     during the render that follows a bump, and stale for anything that reads
     it synchronously after calling undo(). Getters make the four derived
     fields true whenever they are asked, in either context, and the render
     still repaints because bump() is what schedules it. */
  return {
    push, undo, redo, forget, clear,
    get canUndo() { return past.current.length > 0; },
    get canRedo() { return future.current.length > 0; },
    get undoLabel() { return past.current[past.current.length - 1]?.label ?? null; },
    get redoLabel() { return future.current[0]?.label ?? null; },
  };
}

/** ⌘Z / ⌘⇧Z (and the Ctrl equivalents), bound at the document.

    Skipped entirely while focus is in a field: every text input already has
    the browser's own undo, and stealing ⌘Z from a half-typed task title to
    resurrect a deleted row would be actively hostile. `isContentEditable`
    covers the same case for any rich field added later. */
export function useUndoShortcuts(history: History, enabled = true) {
  // Read through a ref so the listener is bound once rather than re-bound on
  // every keystroke-driven re-render.
  const ref = useRef(history);
  ref.current = history;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;

      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;

      e.preventDefault();
      if (e.shiftKey) ref.current.redo();
      else ref.current.undo();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
}
