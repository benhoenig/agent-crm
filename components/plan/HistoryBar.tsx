"use client";

/* ↩ ↪ for the plan column.

   ABOVE ALL THREE CARDS, not inside one of them, because the stack spans all
   three: a task moves from the backlog into the day, and ติดตามวันนี้ writes
   into the day too. Putting the control in the plan card's header would say it
   only governs the plan, which would be a lie in both directions.

   EACH BUTTON NAMES ITS TARGET. Some actions never reach the stack at all — a
   logged follow-up cannot be un-logged — so "the last thing I did" and "the
   last undoable thing I did" are not always the same. Showing the label turns
   that from a nasty surprise into a visible fact. On a phone the label is
   dropped and only the arrows remain; the title attribute still carries it. */

import { Undo2, Redo2 } from "lucide-react";
import type { History } from "./useHistory";

export function HistoryBar({ history }: { history: History }) {
  const { canUndo, canRedo, undo, redo, undoLabel, redoLabel } = history;

  // Nothing done yet this session: no stack, so no chrome. The bar appears
  // with the first undoable action rather than sitting there greyed out.
  if (!canUndo && !canRedo) return null;

  return (
    <div className="-mb-1 flex items-center justify-end gap-1.5">
      <Btn
        icon={<Undo2 size={14} />}
        text={undoLabel}
        disabled={!canUndo}
        onClick={undo}
        title={canUndo ? `ย้อนกลับ: ${undoLabel}` : "ไม่มีอะไรให้ย้อนกลับ"}
        aria-label={canUndo ? `ย้อนกลับ: ${undoLabel}` : "ย้อนกลับ"}
      />
      <Btn
        icon={<Redo2 size={14} />}
        text={null}
        disabled={!canRedo}
        onClick={redo}
        title={canRedo ? `ทำซ้ำ: ${redoLabel}` : "ไม่มีอะไรให้ทำซ้ำ"}
        aria-label={canRedo ? `ทำซ้ำ: ${redoLabel}` : "ทำซ้ำ"}
      />
    </div>
  );
}

function Btn({ icon, text, disabled, onClick, title, ...rest }: {
  icon: React.ReactNode;
  text: string | null;
  disabled: boolean;
  onClick: () => void;
  title: string;
} & React.AriaAttributes) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      {...rest}
      className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[0.72rem] font-medium text-ink-2 transition-colors hover:text-accent-text disabled:opacity-35 disabled:hover:text-ink-2"
    >
      {icon}
      {/* Hidden under 640px — the arrow plus its tooltip is enough on a phone,
          and a wrapping label would push the cards down. */}
      {text && <span className="hidden max-w-[11rem] truncate sm:inline">{text}</span>}
    </button>
  );
}
