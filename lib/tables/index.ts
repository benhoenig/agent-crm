/* Sheets-style grids — the shared vocabulary between the grid, the column
   manager and the per-user preference store.

   PORTED FROM the Klaichan CRM SheetTable machinery (Ben, 2026-08-28), after
   the plain restyle of Table/Th/Td turned out to be half the answer. The
   lattice and the density are style; the column manager, the frozen identity
   column and the per-person layout are not, and they are what make a 20-column
   grid usable at all.

   Client-safe: pure types and pure functions, no DB import. The read lives in
   lib/tables/queries.ts and the write in lib/tables/actions.ts — the same
   split lib/repo/options.ts and lib/options/ already use here.

   THE REGISTRY IS CODE, THE PREFERENCES ARE DATA. Which columns EXIST, what
   they are called and how a cell renders are decisions with code behind them;
   the order they sit in and which ones a person hides are not. That is why
   `resolve` treats a stored order as advisory and re-derives the real set from
   the registry on every read. */

import type { ReactNode } from "react";
import type { Tone } from "@/components/ui";

/** The grids that carry a column manager. A key here needs a registry in its
    page and nothing else — the store validates against this list, so adding a
    configurable table is not a migration. */
export const TABLE_KEYS = ["listings", "leads"] as const;

/** The most rows a grid will load in one go.

    THE GRIDS DO NOT PAGINATE (Ben, 2026-08-29: 25 rows a page "is making sales
    feel like it's harder than working on google sheet"). A sheet is one
    continuous scroll and a header you click to sort, and both of those need
    the WHOLE set in hand — a sort over page 3 of 15 sorts page 3, which is a
    wrong answer delivered confidently. So the book arrives at once and the
    grid virtualises the rendering.

    This cap is the backstop, not the design. 1,649 listings company-wide today
    and the largest personal book is 424, so nothing comes near it; it exists
    so that a runaway import cannot try to serialise a million rows into a
    page. When it bites, the grid SAYS SO in its caption rather than quietly
    showing a prefix — a silently truncated list reads as a complete one. */
export const GRID_MAX_ROWS = 5000;
export type TableKey = (typeof TABLE_KEYS)[number];

export const isTableKey = (k: string): k is TableKey =>
  (TABLE_KEYS as readonly string[]).includes(k);

/** How one cell is painted, when it is painted at all.

    THE CELL WEARS THE COLOUR, not a chip inside it — that is the whole look.
    Klaichan mixes an option's palette hue into the surface through a
    `.cell-wash` class and a `--wash-mix` per theme; here the option table
    already carries a `tone` (lib/repo/options.ts toneMap), and every tone
    already has a `-soft` token that is re-picked per theme in globals.css. So
    a tone IS the fill, with no new CSS and no second colour system to keep in
    step. `className` is the escape hatch for the states that are not option
    rows at all — an SLA breach, a stale post. */
export interface CellFill {
  tone?: Tone;
  className?: string;
}

/** Ascending, descending, or the order the server sent. */
export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

export interface SheetColumn<T> {
  key: string;
  label: string;
  /**
   * The value this column sorts on. Omit and the header is not clickable.
   *
   * SEPARATE FROM `cell` BECAUSE A CELL IS A ReactNode. "12.5M" sorts as a
   * string and puts 9.8M after 12.5M; the number behind it does not. So the
   * registry says what the column MEANS as well as how it looks, and the two
   * can disagree — วันที่ shows "3 วันก่อน" and sorts on the date.
   */
  sort?: (row: T) => string | number | null | undefined;
  /** The identity column: frozen to the left, never hideable, never filled.
      Exactly one per table — a row with nothing to name it is not a row. */
  locked?: boolean;
  /** Numbers and dates line up right; words do not. `center` is for the
      one-glyph columns (a grade letter, a tick) where a fill would otherwise
      read as a colour bar with something stuck to its left edge. */
  align?: "right" | "center";
  /** Minimum width in px. Prose columns need one or they collapse to the
      widest word; short ones are better left to the browser. */
  width?: number;
  cell: (row: T) => ReactNode;
  fill?: (row: T) => CellFill | undefined;
}

/** What one person has decided about one grid. Both lists are advisory. */
export interface TablePrefs {
  order: string[];
  hidden: string[];
}

export const EMPTY_PREFS: TablePrefs = { order: [], hidden: [] };

/** Order rows by one column.

    EMPTY LAST, ALWAYS, in both directions. A blank cell is "not answered",
    not "smallest" — sorting ราคา ascending should open with the cheapest
    listing, not with forty rows that have no price. Reversing that is the
    single most common way a sort feels broken.

    Strings compare with Thai collation: JS's default is UTF-16 code points,
    which interleaves Thai vowels and tone marks into an order no reader
    recognises as alphabetical. */
export function sortRows<T>(
  rows: T[],
  column: SheetColumn<T> | undefined,
  dir: SortDir
): T[] {
  if (!column?.sort) return rows;
  const key = column.sort;
  const sign = dir === "asc" ? 1 : -1;
  // A copy: the caller's array is props, and sorting in place would mutate
  // React's own data between renders.
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const xEmpty = x === null || x === undefined || x === "";
    const yEmpty = y === null || y === undefined || y === "";
    if (xEmpty || yEmpty) return xEmpty && yEmpty ? 0 : xEmpty ? 1 : -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x).localeCompare(String(y), "th") * sign;
  });
}

/** Every grid's prefs for one person, keyed by table. Absent = untouched. */
export type TablePrefsMap = Partial<Record<TableKey, TablePrefs>>;

/** The registry, re-ordered and filtered by a person's saved preference.

    Three rules, and each exists because the alternative breaks on a RELEASE
    rather than in testing:

      1. A saved key the registry no longer has is DROPPED. Otherwise a column
         retired in code renders as a permanently blank strip for everyone who
         happened to open the manager once.
      2. A registry key the saved order does not mention is APPENDED, visible,
         in registry order. Otherwise a column shipped in a new release is
         invisible to exactly the people who use the feature most, and reads
         as "it wasn't built".
      3. The locked column is forced to the front and forced visible, whatever
         the stored arrays say. It is the row's identity and the frozen left
         edge; a stale tab must not be able to post it away. */
export function resolve<T>(
  registry: SheetColumn<T>[],
  prefs: TablePrefs | undefined
): { ordered: SheetColumn<T>[]; visible: SheetColumn<T>[] } {
  const byKey = new Map(registry.map((c) => [c.key, c]));
  const seen = new Set<string>();
  const ordered: SheetColumn<T>[] = [];

  for (const key of prefs?.order ?? []) {
    const col = byKey.get(key);
    if (!col || seen.has(key)) continue; // rule 1 (and a duplicated key)
    seen.add(key);
    ordered.push(col);
  }
  for (const col of registry) {
    // rule 2
    if (seen.has(col.key)) continue;
    seen.add(col.key);
    ordered.push(col);
  }

  // rule 3
  const lockedAt = ordered.findIndex((c) => c.locked);
  if (lockedAt > 0) ordered.unshift(...ordered.splice(lockedAt, 1));

  const hidden = new Set(prefs?.hidden ?? []);
  return {
    ordered,
    visible: ordered.filter((c) => c.locked || !hidden.has(c.key)),
  };
}

/** Normalise what a client sends before it is stored. The same filtering as
    `resolve`, applied on the WRITE side too, so the stored row never contains
    a key the app cannot explain — a stale tab and a forged request are the
    same case. */
export function sanitize(
  knownKeys: string[],
  lockedKey: string | undefined,
  input: TablePrefs
): TablePrefs {
  const known = new Set(knownKeys);
  const order: string[] = [];
  const seen = new Set<string>();
  for (const k of input.order) {
    if (!known.has(k) || seen.has(k)) continue;
    seen.add(k);
    order.push(k);
  }
  const hidden = [
    ...new Set(input.hidden.filter((k) => known.has(k) && k !== lockedKey)),
  ];
  return { order, hidden };
}

/** Keys the column manager must never let a person hide. Kept here rather
    than in the component so `resolve` (read) and the manager (write) cannot
    disagree about which those are. */
export function unhideable<T>(columns: SheetColumn<T>[]): Set<string> {
  return new Set(columns.filter((c) => c.locked).map((c) => c.key));
}
