"use client";

/* The Sheets-style grid, ported from the Klaichan CRM SheetTable
   (Ben, 2026-08-28).

   WHAT MAKES IT READ LIKE A SPREADSHEET, and why each part is not decoration:

     every cell bordered   The old table drew ROW dividers only, so the eye
                           tracked rows fine and columns not at all. At eight
                           columns that is survivable; at twenty it is the
                           whole problem. A lattice is what lets you read DOWN.
     30px rows             From 44. Fourteen rows in the height that showed
                           nine.
     frozen header + name  Scroll to column 15 and you still know which row
                           and which field. Without it a wide grid is a maze.
     conditional FILLS     The cell wears the colour, not a chip inside it —
                           so a column of statuses reads as bands rather than
                           as twenty separate pills.
     column manager        Drag to reorder, tick to hide, saved per person.

     whole book, virtualised  No pages. The entire set is in memory and only
                              the ~40 rows on screen are in the DOM.
     click-header-to-sort     Over every row, not over a page of them.

   NO PAGES, AND SORTING IS WHY (Ben, 2026-08-29: 25 rows a page "is making
   sales feel like it's harder than working on google sheet"). The two are one
   decision. A sort over page 3 of 15 sorts page 3 — a wrong answer delivered
   with total confidence — so a header you can click requires the whole book in
   hand, and once the whole book is in hand the pages have nothing left to do.

   THE VIRTUALISER IS TWENTY LINES, NOT A DEPENDENCY. Every row is exactly
   ROW_H tall by construction (see CELL below), so "which rows are visible" is
   scrollTop ÷ ROW_H — no measuring, no resize observers per row, none of what
   a virtualisation library is actually for. Two spacer rows hold the scroll
   height open. This is the same call the column manager makes about drag
   libraries a few hundred lines down.

   WHAT IT IS STILL NOT. There is no in-cell editing: an accidental edit on a
   phone is its own failure mode, and rows navigate to the existing detail
   page, so this stays a way IN to a record rather than a second place to
   change one.

   The registry lives with each page — this file knows how to paint a grid and
   nothing about listings or leads.

   DIVERGENCE FROM THE SOURCE: fills are a `tone`, not a palette hue mixed
   through a `.cell-wash` class. The options table here already carries a tone
   per row and every tone already has a `-soft` token re-picked per theme in
   globals.css, so a tone IS the fill — no new CSS, and no second colour
   system to keep in step with the Pills everywhere else. */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Columns3, GripVertical, Lock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, type Tone } from "@/components/ui";
import {
  resolve,
  sortRows,
  unhideable,
  type SheetColumn,
  type SortState,
  type TablePrefs,
} from "@/lib/tables";
import { resetTablePrefs, saveTablePrefs } from "@/lib/tables/actions";

/** tone → the cell's own background. `-soft` rather than the solid token: a
    solid fill would need its own foreground colour per tone, and at cell size
    a wash is what reads as a band rather than as twenty stickers. */
const FILL_TONE: Record<Tone, string> = {
  accent: "bg-accent-soft",
  good: "bg-good-soft",
  warn: "bg-warn-soft",
  bad: "bg-bad-soft",
  info: "bg-info-soft",
  muted: "bg-surface-3",
};

export function SheetTable<T>({
  tableKey,
  columns,
  rows,
  rowKey,
  href,
  prefs,
  empty,
  caption,
  rowNumbers = true,
}: {
  tableKey: string;
  columns: SheetColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Where a row goes when clicked. Omit for a grid whose rows are not
      records — the rows then lose their pointer cursor too, so the grid never
      offers a click it will not answer. */
  href?: (row: T) => string;
  /** What this person saved last time; undefined = never opened the manager. */
  prefs?: TablePrefs;
  empty: string;
  /** Sits next to the column button — "แสดง 20 จาก 210 รายการ". */
  caption?: string;
  /** The 1,2,3… gutter — the count made visible. */
  rowNumbers?: boolean;
}) {
  const router = useRouter();

  /* The saved layout is seeded from the server and then owned here. The
     manager has to feel instant (it is a checkbox), so this is the truth for
     the rest of the session and the write is fire-and-forget — the same
     bargain the daily plan already makes with its ticks. */
  const [local, setLocal] = useState<TablePrefs>(() => ({
    order: prefs?.order ?? [],
    hidden: prefs?.hidden ?? [],
  }));
  const [managing, setManaging] = useState(false);
  const [, startSave] = useTransition();

  const { ordered, visible } = useMemo(
    () => resolve(columns, local),
    [columns, local]
  );
  const lockedKey = useMemo(
    () => columns.find((c) => c.locked)?.key,
    [columns]
  );
  const knownKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const pinned = useMemo(() => unhideable(columns), [columns]);

  /* SORT IS SESSION STATE, NOT A SAVED PREFERENCE. Which columns you keep is
     how you like to work; "sort by price for a second" is a question you are
     asking right now. Saving it would mean coming back tomorrow to a grid
     ordered by something you have forgotten choosing. */
  const [sort, setSort] = useState<SortState | null>(null);
  const sortCol = useMemo(
    () => (sort ? columns.find((c) => c.key === sort.key) : undefined),
    [columns, sort]
  );
  const view = useMemo(
    () => (sort ? sortRows(rows, sortCol, sort.dir) : rows),
    [rows, sort, sortCol]
  );

  /* Click cycles asc → desc → off. The third state matters: the server order
     (newest first) is itself an answer, and without a way back you would have
     to reload the page to get it. */
  const cycle = (key: string) =>
    setSort((s) =>
      s?.key !== key
        ? { key, dir: "asc" }
        : s.dir === "asc"
          ? { key, dir: "desc" }
          : null
    );

  /* ---- the virtualiser ----
     `win` is the slice of `view` that is actually in the DOM. Recomputed on
     scroll and on resize; the two spacer rows below hold the remaining height
     so the scrollbar tells the truth about the whole set. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [win, setWin] = useState({ start: 0, end: 60 });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = Math.floor(el.scrollTop / ROW_H);
    const onScreen = Math.ceil(el.clientHeight / ROW_H);
    setWin((prev) => {
      const start = Math.max(0, first - OVERSCAN);
      const end = first + onScreen + OVERSCAN;
      // Same window → same object, so scrolling inside the overscan band does
      // not re-render the grid at all.
      return prev.start === start && prev.end === end ? prev : { start, end };
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure, view.length]);

  // Re-sorting or re-filtering under a scrolled viewport would otherwise leave
  // you halfway down a list you have never seen.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setWin({ start: 0, end: 60 });
  }, [sort, rows]);

  const start = Math.min(win.start, Math.max(0, view.length - 1));
  const end = Math.min(win.end, view.length);
  const slice = view.slice(start, end);

  // The table's natural width under `table-layout: fixed`. Set as a min-width
  // so a narrow viewport scrolls sideways instead of crushing every column.
  const tableW = useMemo(
    () =>
      (rowNumbers ? GUTTER_W : 0) +
      visible.reduce((sum, c) => sum + (c.width ?? COL_W), 0),
    [visible, rowNumbers]
  );

  const persist = (next: TablePrefs) => {
    setLocal(next);
    // Always store the FULL resolved order, not the fragment that was dragged:
    // a partial order plus a later release's new column would otherwise
    // reshuffle silently the next time the page loaded.
    startSave(async () => {
      try {
        await saveTablePrefs(tableKey, next, knownKeys, lockedKey);
      } catch {
        /* A layout that failed to save is not worth an error banner over the
           grid — the columns are already where they were put for this
           session, and the next change tries again. */
      }
    });
  };

  const move = (from: string, to: string) => {
    const keys = ordered.map((c) => c.key);
    const a = keys.indexOf(from);
    const b = keys.indexOf(to);
    if (a < 0 || b < 0 || a === b) return;
    keys.splice(b, 0, ...keys.splice(a, 1));
    persist({ ...local, order: keys });
  };

  const toggle = (key: string) => {
    const hidden = local.hidden.includes(key)
      ? local.hidden.filter((k) => k !== key)
      : [...local.hidden, key];
    // Store the resolved order alongside, so the first thing anyone ever does
    // (hiding a column) also pins the order they were looking at.
    persist({ order: ordered.map((c) => c.key), hidden });
  };

  const reset = () => {
    setLocal({ order: [], hidden: [] });
    startSave(async () => {
      try {
        await resetTablePrefs(tableKey);
      } catch {
        /* see persist */
      }
    });
  };

  /* Row navigation mirrors LinkedRow's two guards: a click that landed on
     another control is left alone, and a click that ends a text selection is
     left alone so cell values stay copyable. */
  function ownsClick(e: React.MouseEvent<HTMLTableRowElement>) {
    const el = e.target as HTMLElement | null;
    if (el?.closest("a, button, input, select, textarea, label, [role='button']"))
      return false;
    return !window.getSelection()?.toString();
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
        <span className="num text-[0.72rem] text-ink-3">{caption}</span>
        <button
          type="button"
          onClick={() => setManaging((v) => !v)}
          aria-expanded={managing}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-ctl border px-2.5 py-1 text-[0.75rem] font-medium transition-colors",
            managing
              ? "border-accent bg-accent-soft text-accent-text"
              : "border-line-strong text-ink-2 hover:border-accent hover:text-accent-text"
          )}
        >
          <Columns3 size={13} /> คอลัมน์
          <span className="num text-[0.7rem] text-ink-3">
            {visible.length}/{columns.length}
          </span>
        </button>
      </div>

      {managing && (
        <ColumnManager
          columns={ordered}
          hidden={local.hidden}
          pinned={pinned}
          onToggle={toggle}
          onMove={move}
          onReset={reset}
        />
      )}

      {view.length === 0 ? (
        <div className="grid place-items-center py-12 text-[0.8rem] text-ink-3">
          {empty}
        </div>
      ) : (
        /* max-h keeps the sticky header meaningful: without a scroll container
           of its own the header would only stick to the window, and the filter
           bar above would slide out from under it. */
        <div
          ref={scrollRef}
          className="max-h-[calc(100vh-18rem)] overflow-auto overscroll-contain"
        >
          {/* FIXED LAYOUT, and it is the virtualiser that requires it. With
              `auto`, the browser sizes columns from the cells it can see — so
              scrolling a new set of rows into the DOM would re-measure and the
              columns would jitter under the cursor. Fixed sizing from the
              registry's own widths is stable whatever is on screen. */}
          <table
            className="border-separate border-spacing-0 whitespace-nowrap text-[0.78rem] leading-[1.35]"
            style={{ tableLayout: "fixed", width: "100%", minWidth: tableW }}
          >
            <thead>
              <tr>
                {rowNumbers && (
                  <th
                    style={{ width: GUTTER_W }}
                    className={cn(HEAD, "sticky left-0 z-40 px-1.5 text-right")}
                  />
                )}
                {visible.map((c, i) => {
                  const on = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={
                        on
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      style={{ width: c.width ?? COL_W }}
                      className={cn(
                        HEAD,
                        // The identity column freezes flush against the gutter,
                        // so its offset is exactly the gutter's width — or zero
                        // when there is no gutter.
                        i === 0 &&
                          (rowNumbers
                            ? "sticky left-[42px] z-40"
                            : "sticky left-0 z-40"),
                        i === 0 && "border-r-line-strong",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        on && "text-accent-text"
                      )}
                    >
                      {/* A column with no `sort` in the registry gets a plain
                          label — no pointer, no arrow slot, nothing offering a
                          click that does nothing. */}
                      {c.sort ? (
                        <button
                          type="button"
                          onClick={() => cycle(c.key)}
                          title={`เรียงตาม ${c.label}`}
                          className={cn(
                            "inline-flex w-full items-center gap-1 hover:text-accent-text",
                            c.align === "right" && "justify-end",
                            c.align === "center" && "justify-center"
                          )}
                        >
                          <span className="truncate">{c.label}</span>
                          {on &&
                            (sort.dir === "asc" ? (
                              <ArrowUp size={11} className="shrink-0" />
                            ) : (
                              <ArrowDown size={11} className="shrink-0" />
                            ))}
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Spacer rows stand in for everything above and below the
                  window, so the scrollbar measures the whole book rather than
                  the forty rows currently rendered. */}
              {start > 0 && (
                <tr aria-hidden style={{ height: start * ROW_H }} />
              )}
              {slice.map((row, si) => (
                <tr
                  key={rowKey(row)}
                  className={cn("group", href && "cursor-pointer")}
                  onClick={
                    href
                      ? (e) => {
                          if (!ownsClick(e)) return;
                          if (e.metaKey || e.ctrlKey)
                            window.open(href(row), "_blank", "noopener");
                          else router.push(href(row));
                        }
                      : undefined
                  }
                  onAuxClick={
                    href
                      ? (e) => {
                          if (e.button !== 1 || !ownsClick(e)) return;
                          e.preventDefault();
                          window.open(href(row), "_blank", "noopener");
                        }
                      : undefined
                  }
                >
                  {rowNumbers && (
                    <td
                      style={{ width: GUTTER_W }}
                      className={cn(
                        CELL,
                        "sticky left-0 z-20 bg-surface-2 text-right",
                        NUMCOL
                      )}
                    >
                      {start + si + 1}
                    </td>
                  )}
                  {visible.map((c, i) => {
                    const f = c.fill?.(row);
                    return (
                      <td
                        key={c.key}
                        className={cn(
                          CELL,
                          // The identity column is frozen, so it must stay
                          // OPAQUE — a wash here would let the columns
                          // scrolling beneath it show through.
                          i === 0
                            ? cn(
                                "sticky z-20 border-r-line-strong bg-surface-2 font-medium",
                                rowNumbers ? "left-[42px]" : "left-0"
                              )
                            : f?.tone
                              ? cn("font-medium", FILL_TONE[f.tone])
                              : f?.className
                                ? cn("font-medium", f.className)
                                : "bg-surface-2",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center"
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {end < view.length && (
                <tr aria-hidden style={{ height: (view.length - end) * ROW_H }} />
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* Shared cell metrics. `h-[30px] py-0` rather than padding-driven height so
   every row is exactly the same height whatever a cell contains — a two-line
   cell in a dense grid breaks the lattice the whole design rests on, and
   truncation is the honest fix. A registry column that wants to say two things
   says them side by side (see the listings NAME column). */
/** Every row is exactly this tall — the fact the virtualiser is built on, so
    it lives next to the class that enforces it. Change one and change both. */
export const ROW_H = 30;
/** Rows kept in the DOM above and below the viewport, so a flick of the wheel
    lands on rendered content rather than on a blank band. */
const OVERSCAN = 10;
/** The row-number gutter, and the default width for a registry column that
    names none — `table-layout: fixed` needs a number for every column. */
const GUTTER_W = 42;
const COL_W = 120;

const CELL =
  "h-[30px] max-w-[18rem] truncate border-r border-b border-line px-2.5 align-middle " +
  // Hover tints OVER the cell's own fill instead of replacing it: a background
  // swap would erase the conditional colour at the exact moment the cursor is
  // on it. An inset shadow composites; background-color does not.
  "group-hover:shadow-[inset_0_0_0_999px_var(--surface-hover)]";

const HEAD =
  "sticky top-0 z-30 h-[30px] whitespace-nowrap border-r border-b border-line-strong bg-surface-3 " +
  "px-2.5 text-left align-middle text-[0.7rem] font-semibold text-ink-2";

const NUMCOL = "num w-[42px] min-w-[42px] px-1.5 text-[0.68rem] text-ink-3";

/* ---------- the column manager ------------------------------------------- */

/** Drag to reorder, tick to show. Native HTML5 drag rather than a library:
    this is one list of one-line rows, and the app has no other drag surface to
    share a dependency with (the daily plan reorders with its own pointer
    handlers).

    The locked column is rendered but inert — showing it greyed says "this one
    is the row's name" far better than leaving a gap where it should be. */
function ColumnManager<T>({
  columns,
  hidden,
  pinned,
  onToggle,
  onMove,
  onReset,
}: {
  columns: SheetColumn<T>[];
  hidden: string[];
  pinned: Set<string>;
  onToggle: (key: string) => void;
  onMove: (from: string, to: string) => void;
  onReset: () => void;
}) {
  const dragged = useRef<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  return (
    <div className="border-b border-line bg-surface-3 px-4 py-3">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[0.78rem] font-semibold">จัดการคอลัมน์</span>
        <span className="text-[0.72rem] text-ink-3">
          ลากเพื่อสลับลำดับ · ติ๊กเพื่อแสดง/ซ่อน ·{" "}
          <b className="font-medium text-good">จำไว้เฉพาะบัญชีคุณ</b>
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1.5">
        {columns.map((c) => {
          const off = hidden.includes(c.key);
          const fixed = pinned.has(c.key);
          return (
            <div
              key={c.key}
              draggable={!c.locked}
              onDragStart={() => {
                dragged.current = c.key;
              }}
              onDragEnd={() => {
                dragged.current = null;
                setOver(null);
              }}
              onDragOver={(e) => {
                if (!dragged.current || c.locked) return;
                e.preventDefault();
                setOver(c.key);
              }}
              onDragLeave={() => setOver((k) => (k === c.key ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragged.current && !c.locked) onMove(dragged.current, c.key);
                dragged.current = null;
                setOver(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-ctl border bg-surface-2 px-2 py-1.5 text-[0.76rem] transition-colors",
                fixed
                  ? "cursor-default opacity-70"
                  : "cursor-grab active:cursor-grabbing",
                over === c.key
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-line-strong"
              )}
            >
              {fixed ? (
                <Lock size={11} className="shrink-0 text-ink-3" />
              ) : (
                <GripVertical size={12} className="shrink-0 text-ink-3" />
              )}
              <label
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2",
                  !fixed && "cursor-pointer"
                )}
              >
                <input
                  type="checkbox"
                  checked={fixed || !off}
                  disabled={fixed}
                  onChange={() => onToggle(c.key)}
                  className="size-3 shrink-0 accent-[var(--accent)]"
                />
                <span className="truncate">{c.label}</span>
              </label>
              {fixed && (
                <span className="shrink-0 text-[0.65rem] text-ink-3">ตรึง</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-2.5 inline-flex items-center gap-1.5 text-[0.74rem] font-medium text-accent-text hover:underline"
      >
        <RotateCcw size={12} /> คืนค่าเริ่มต้น
      </button>
    </div>
  );
}

/* ---------- cell helpers, shared by every registry ----------------------- */

/** A value that may be missing. Every registry uses this rather than `|| "—"`
    so an empty cell looks the same everywhere and 0 never reads as blank. */
export function Val({
  children,
  mono,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  const empty = children == null || children === "" || children === "—";
  if (empty) return <span className="text-ink-3">—</span>;
  return <span className={cn(mono && "num")}>{children}</span>;
}

/** Muted secondary text — prose columns that are context, not the answer. */
export function Dim({ children }: { children: React.ReactNode }) {
  const empty = children == null || children === "" || children === "—";
  if (empty) return <span className="text-ink-3">—</span>;
  return <span className="text-ink-2">{children}</span>;
}
