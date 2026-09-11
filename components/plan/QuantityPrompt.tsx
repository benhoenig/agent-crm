"use client";

/* "ทำได้จริงกี่รายการ?" — the one question between a planned count and the
   scoreboard (0026, Ben 2026-08-30).

   WHY THIS EXISTS AT ALL. A task can now carry a target: "โทรหาเจ้าของ 10 ราย".
   The obvious shortcut is to log that 10 when the box is ticked, and it is
   wrong — the plan records what you MEANT to do, and `actions` records what
   happened. Logging the target would quietly turn every intention into a
   result and the monthly numbers would drift up with nobody lying. So the
   tick stops here, pre-filled with the target, and logs what you confirm.

   IT ONLY APPEARS FOR TASKS THAT HAVE A TARGET. A plain to-do, a promoted
   follow-up, a categorised task nobody put a number on — all tick straight
   through, exactly as before. Adding a dialog to every checkbox to serve the
   minority that needs one is how a fast surface stops being fast.

   MOUNTED BY THE TWO PLANNER OWNERS, PlanColumn and PlanBrowser, because the
   tick can come from any of five row renderers and the prompt has to look and
   behave the same from all of them. It is driven entirely by planner state,
   so neither mount point knows anything about it beyond where to put it. */

import { useEffect, useRef, useState } from "react";
import type { Planner } from "./usePlanner";

export function QuantityPrompt({ planner }: { planner: Planner }) {
  const { quantityPrompt, confirmQuantity, cancelQuantity } = planner;
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-seed and focus on each open. Selecting the text means the common case
  // — "the plan said 5 and I did 5" — is Enter, and the uncommon one is a
  // digit then Enter, with no cursor work either way.
  useEffect(() => {
    if (!quantityPrompt) return;
    setValue(String(quantityPrompt.target));
    const t = setTimeout(() => inputRef.current?.select(), 0);
    return () => clearTimeout(t);
  }, [quantityPrompt]);

  useEffect(() => {
    if (!quantityPrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelQuantity();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [quantityPrompt, cancelQuantity]);

  if (!quantityPrompt) return null;

  const n = value.trim() === "" ? null : Number(value);
  // Blank is allowed and means "logged, but no count" — 0 is a different
  // answer and a real one ("I planned five and did none").
  const valid = n === null || (Number.isFinite(n) && n >= 0);

  return (
    /* Cancelling on the backdrop is safe here in a way it is not on a form:
       nothing has been typed that can be lost, and nothing has been written —
       the task simply stays unticked. */
    <div
      onClick={cancelQuantity}
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-card border border-line-strong bg-surface p-5 shadow-xl"
      >
        <h2 className="text-sm font-semibold">ทำได้จริงกี่รายการ?</h2>
        <p className="truncate pt-0.5 text-[0.78rem] text-ink-3">
          {quantityPrompt.title}
        </p>

        <div className="flex items-center gap-2 pt-4">
          <input
            ref={inputRef}
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) confirmQuantity(n);
            }}
            aria-label="จำนวนที่ทำได้จริง"
            className="num w-28 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[0.95rem] text-ink outline-none transition-colors focus:border-accent"
          />
          <span className="num text-[0.72rem] text-ink-3">
            ตั้งเป้าไว้ {quantityPrompt.target}
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-5">
          <button
            type="button"
            onClick={cancelQuantity}
            className="rounded-full px-3.5 py-2 text-[0.8rem] font-semibold text-ink-2 transition-colors hover:text-ink"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => confirmQuantity(n)}
            disabled={!valid}
            className="rounded-full bg-accent px-4 py-2 text-[0.8rem] font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
