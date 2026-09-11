import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { PendingLink } from "./PendingLink";
import { formatNum } from "@/lib/format";

/* ── Card ─────────────────────────────────────────────────────────── */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface-2 shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-1">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action}
    </div>
  );
}

/* ── Button ───────────────────────────────────────────────────────── */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink font-semibold hover:bg-accent-hover shadow-glow",
  secondary:
    "border border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface-3",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-bad-soft text-bad hover:opacity-85",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-ctl px-4 py-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50";

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_STYLES[variant], className)}
      {...props}
    />
  );
}

/** <Link> styled exactly like Button — for navigation CTAs ("+ เพิ่มทรัพย์"). */
export function LinkButton({
  variant = "primary",
  className,
  href,
  children,
}: {
  variant?: ButtonVariant;
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(BUTTON_BASE, BUTTON_STYLES[variant], className)}
    >
      {children}
    </Link>
  );
}

/* ── Status dot + label (statuses are dots + text, not solid pills) ── */
export type Tone = "accent" | "good" | "warn" | "bad" | "info" | "muted";

const DOT_COLOR: Record<Tone, string> = {
  accent: "bg-accent",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  muted: "bg-ink-3",
};

export function Dot({ tone = "muted", label }: { tone?: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("size-1.5 rounded-full", DOT_COLOR[tone])} />
      {label}
    </span>
  );
}

/* ── Pill — soft-tinted tag (grades, potentials, counts) ──────────── */
const PILL_TONE: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent-text",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  muted: "bg-surface-3 text-ink-2",
};

export function Pill({
  tone = "muted",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        PILL_TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Stat — KPI tile (label / big mono number / delta) ────────────── */
export function Stat({
  label,
  value,
  sub,
  subTone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  subTone?: Tone;
}) {
  const subColor: Record<Tone, string> = {
    accent: "text-accent-text",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
    info: "text-info",
    muted: "text-ink-3",
  };
  return (
    <Card className="px-5 py-4">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="num pt-1.5 text-[1.75rem] leading-none font-semibold">
        {value}
      </div>
      {sub && (
        <div className={cn("pt-2 text-xs", subColor[subTone])}>{sub}</div>
      )}
    </Card>
  );
}

/* ── Input ────────────────────────────────────────────────────────── */
export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-ctl border border-line bg-surface-2 px-3 py-2 text-sm text-ink transition-colors outline-none placeholder:text-ink-3 focus:border-accent",
        className
      )}
      {...props}
    />
  );
}

/* ── Select / Textarea — same control chrome as Input ─────────────── */
// ComponentPropsWithRef, like Textarea: the accounts editor needs a ref to
// roll the value back when a confirmation is cancelled.
export function Select({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<"select">) {
  return (
    <select
      className={cn(
        "w-full rounded-ctl border border-line bg-surface-2 px-3 py-2 text-sm text-ink transition-colors outline-none focus:border-accent",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** Enum dropdown for forms — "" placeholder option then the enum values. */
export function EnumSelect({
  name,
  values,
  defaultValue,
  placeholder = "— เลือก —",
  required,
}: {
  name: string;
  values: readonly string[];
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Select name={name} defaultValue={defaultValue ?? ""} required={required}>
      <option value="">{placeholder}</option>
      {values.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </Select>
  );
}

// ComponentPropsWithRef, not TextareaHTMLAttributes: the post-template editor
// needs a ref to drop a placeholder at the cursor. React 19 passes `ref`
// through as a plain prop; the types just have to admit it.
export function Textarea({
  className,
  ...props
}: React.ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-ctl border border-line bg-surface-2 px-3 py-2 text-sm text-ink transition-colors outline-none placeholder:text-ink-3 focus:border-accent",
        className
      )}
      {...props}
    />
  );
}

/* ── Field — label wrapper for form controls ──────────────────────── */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-ink-2">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

/* ── FieldRow — label left, control right ──────────────────────────
   The create/edit forms for a listing and a lead (Ben, 2026-08-29: the
   packed grid "looks exhausted even before we start filling out"). A listing
   has 42 fields; four across a 4-column grid is 42 things shouting at once.
   One per row with the name on the left is a list you can walk down — and it
   is the shape the record takes once saved (see DL), so filling the form and
   reading the result are the same motion.

   THE COST IS HEIGHT, and it is real: the listing form roughly doubles, to
   about 2,100px. Sections are what keep that walkable, so keep them small
   and titled — a section is the unit you skim, not the field.

   Field, above, is unchanged and still stacks its label. It is used on
   twenty surfaces, most of them dense settings panels where a 14rem label
   column would be absurd; this is a second arrangement, not a replacement. */
export function FieldRows({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  // Edge-to-edge rules, like a list: the rows carry their own px-5, so the
  // dividers span the whole card and the eye has a lane to run down.
  return (
    <div
      className={cn("field-rows mt-1 divide-y divide-line border-t border-line", className)}
    >
      {children}
    </div>
  );
}

export function FieldRow({
  label,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // The value column is CAPPED at 34rem. Left to fill a 5xl modal, a "นอน"
    // number input would be 660px wide, and long text would run past a
    // comfortable line length. Below sm: the two stack, label over control.
    <label
      className={cn(
        "grid items-start gap-x-5 gap-y-1 px-5 py-1.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,34rem)]",
        className
      )}
    >
      {/* pt-[11px] is not a magic number: a control is 1px border + 8px
          padding (see .field-rows in globals.css) + a 20px text-sm line, so
          its first line centres at 16px, and a text-xs label's 16px line box
          centres at 8px. pt-2 lines the two up, and it holds for an input, a
          select and a textarea alike. */}
      <span className="text-xs font-medium text-ink-2 sm:pt-2">
        {label}
      </span>
      <div className="min-w-0">
        {children}
        {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
      </div>
    </label>
  );
}

/* ── PageHeader — title row every surface starts with ─────────────── */
export function PageHeader({
  title,
  sub,
  action,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {sub && <p className="pt-0.5 text-sm text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── EmptyState — pre-import surfaces must look intentional ───────── */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="text-sm font-medium text-ink-2">{title}</div>
      {hint && <div className="max-w-md text-xs text-ink-3">{hint}</div>}
      {action && <div className="pt-3">{action}</div>}
    </div>
  );
}

/* ── Pagination — server-rendered prev/next; hrefFor builds page URLs ─ */
export function Pagination({
  page,
  pageCount,
  total,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (total === 0) return null;
  const nav = (target: number, label: string, enabled: boolean) =>
    enabled ? (
      <PendingLink
        href={hrefFor(target)}
        className="rounded-ctl border border-line px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
      >
        {label}
      </PendingLink>
    ) : (
      <span className="rounded-ctl border border-line px-3 py-1.5 text-xs text-ink-3 opacity-50">
        {label}
      </span>
    );
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-xs text-ink-3">
        หน้า <span className="num">{page}</span>/
        <span className="num">{pageCount}</span> ·{" "}
        <span className="num">{formatNum(total)}</span> รายการ
      </span>
      <div className="flex gap-2">
        {nav(page - 1, "← ก่อนหน้า", page > 1)}
        {nav(page + 1, "ถัดไป →", page < pageCount)}
      </div>
    </div>
  );
}

/* ── DL — label/value fact grid for detail pages ──────────────────── */
export function DL({
  items,
  cols = 3,
}: {
  items: { label: React.ReactNode; value: React.ReactNode }[];
  cols?: 2 | 3 | 4;
}) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[
    cols
  ];
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-4", grid)}>
      {items.map((item, i) => (
        <div key={i}>
          <dt className="text-xs text-ink-3">{item.label}</dt>
          <dd className="pt-0.5 text-sm">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Facts — key/value pairs in a drawer ────────────────────────────
   Ported from the Klaichan CRM sheet's `Row` (Ben, 2026-08-29). Label muted
   on the left, value in medium weight and RIGHT-ALIGNED against it, rows
   tight, no rules between them.

   THE RIGHT ALIGNMENT IS THE TRICK. It pins every value to a shared edge, so
   a run of them reads as a column instead of as text starting wherever its
   label happened to end — which is what lets a pair stay legible at half of
   a 36rem drawer.

   DL, above, is the wide-page version and is unchanged: it is still what
   /projects, /contacts, /deals and /team use, where there is room to put
   three or four facts across. This is the narrow one.

   A `null` value shows as "—" rather than vanishing. Klaichan drops the row;
   on a CRM built out of a spreadsheet, "nobody has ever filled this in" is
   itself worth seeing. */
export function Facts({
  items,
  className,
}: {
  items: { label: React.ReactNode; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-[0.8rem]",
        className
      )}
    >
      {items.map((item, i) => (
        <Fragment key={i}>
          <dt className="text-ink-3">{item.label}</dt>
          <dd className="min-w-0 text-right font-medium break-words">
            {item.value ?? "—"}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** The headline numbers, as tiles rather than a list — นอน / น้ำ / ตร.ม. on a
 *  listing. Klaichan's `Spec`: the three facts you check first are worth
 *  reading at a glance instead of hunting for in a column of fourteen. */
export function SpecTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-card bg-surface-2 py-2.5 text-center">
      <div className="mx-auto mb-1 w-fit text-accent-text">{icon}</div>
      <div className="num text-[1.05rem] leading-none font-semibold">
        {value ?? "—"}
      </div>
      <div className="mt-1 text-[0.68rem] text-ink-3">{label}</div>
    </div>
  );
}

/* ── Table primitives ─────────────────────────────────────────────── */
/* ── Table ─────────────────────────────────────────────────────────
   The Sheets-style grid, ported from the Klaichan CRM SheetTable
   (Ben, 2026-08-28). Every list in the app goes through these three
   components, so the whole app changed with them.

   WHAT MAKES IT READ LIKE A SPREADSHEET, and why each part earns its place:

     every cell bordered  The old table drew ROW dividers only, so the eye
                          tracked rows fine and columns not at all. A lattice
                          is what lets you read DOWN a column — which is what
                          you do when comparing eight listings on price.
     dense rows           py-1.5 from py-3, 0.78rem type from 0.875rem. Half
                          again as many rows in the same height.
     nowrap + truncate    A cell that wraps to two lines breaks the lattice
                          the whole design rests on. Truncation is the honest
                          fix; the row opens the record.
     frozen header        The scroll box is capped, so the header stays put
                          on a long list instead of scrolling away at row 12.

   WHAT IS DELIBERATELY NOT PORTED. Klaichan's grid also carries a column
   manager (drag to reorder, tick to hide, saved per person), a frozen
   identity column, and an inline draft row for adding records. None of those
   are style: each needs every list rewritten as a column REGISTRY, plus a
   table_prefs table behind the manager. They are a separate piece of work,
   and this change deliberately leaves the call sites untouched.

   Nor is her hard `h-[30px]` row. Hers is 23 narrow one-value columns; ours
   stack (a listing name over its legacy code), and a fixed height would clip
   the second line. Padding-driven height keeps those cells whole. */
export function Table({
  className,
  /** Caps the scroll box so `sticky` on the header has something to stick
      inside — an unbounded `overflow` container makes the header freeze at
      its own top, which is no freeze at all. Harmless on a short table: a
      max-height under the content height does nothing. Pass null for a table
      that must never scroll inside itself. */
  maxHeight = "calc(100vh - 14rem)",
  children,
}: {
  className?: string;
  maxHeight?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-auto overscroll-contain"
      style={maxHeight ? { maxHeight } : undefined}
    >
      {/* border-separate, not the default collapse: a collapsed border cannot
          be painted by a sticky cell, so the header's own bottom rule scrolls
          away under it and the rows appear to run into the head. */}
      <table
        className={cn(
          "w-full border-separate border-spacing-0 whitespace-nowrap text-[0.78rem] leading-[1.35]",
          className
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "sticky top-0 z-20 border-r border-b border-line-strong bg-surface-3 px-2.5 py-1.5 text-left align-middle text-[0.7rem] font-semibold whitespace-nowrap text-ink-2 last:border-r-0",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  className,
  wrap,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  /** Opt this cell out of the width clamp and the truncation.

      For cells that hold CONTROLS rather than a value — the inline forms on
      /leave, /listing-updates and the listing's channel row. Klaichan's grid
      never needs this because hers is strictly read-only (no in-cell editing,
      stated in its own header); ours puts a form in a cell in a handful of
      places, and 18rem with `overflow: hidden` would clip one.

      A PROP AND NOT A className OVERRIDE: `cn` is a plain string joiner, not
      tailwind-merge, so passing `max-w-none` would leave both utilities in
      the class list and let stylesheet order decide — which is a coin flip. */
  wrap?: boolean;
}) {
  return (
    <td
      className={cn(
        "border-r border-b border-line px-2.5 py-1.5 align-middle last:border-r-0",
        wrap ? "whitespace-normal" : "max-w-[18rem] truncate",
        className
      )}
      {...props}
    />
  );
}

export { LinkedRow } from "./LinkedRow";
export { TabNav, type TabItem } from "./TabNav";
export { ListingThumb } from "./ListingThumb";
export { PendingLink } from "./PendingLink";

/* ── Skeletons ─────────────────────────────────────────────────────
   Placeholders for content that is still streaming. Every loading.tsx
   and every <Suspense fallback> composes these, so the pending state has
   the same geometry as the real thing — no layout jump when data lands.

   Widths come from a fixed cycle rather than Math.random(): the fallback
   is server-rendered and hydrated, so random widths would mismatch. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-ctl bg-surface-3 motion-reduce:animate-none",
        className
      )}
    />
  );
}

const CELL_W = ["w-24", "w-16", "w-28", "w-12", "w-20", "w-32", "w-14"];

export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-1.5 h-4 w-56" />
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  );
}

/**
 * One <Stat> box, matching its real markup.
 *
 * IT EXISTS BECAUSE THE PAGES WERE FAKING IT. Every stat row used
 * `<Card><CardSkeleton lines={2} /></Card>`, which is wrong twice over:
 * CardSkeleton renders its OWN Card, so the result was a card inside a card
 * with two borders and double padding, and it drew four label/value pairs
 * where a Stat shows one. The row jumped the moment the data arrived, which is
 * the one thing a skeleton exists to prevent.
 *
 * Heights are taken from Stat itself: h-3 for the 12px label, h-7 for the
 * 1.75rem value.
 */
export function StatSkeleton({ sub = false }: { sub?: boolean }) {
  return (
    <Card className="px-5 py-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-24" />
      {sub && <Skeleton className="mt-2.5 h-3 w-16" />}
    </Card>
  );
}

/** The KPI row above a list. `className` takes the page's own grid so the
    columns break at the same width the loaded row does. */
export function StatRowSkeleton({
  count = 4,
  className = "grid grid-cols-2 gap-4 md:grid-cols-4",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <StatSkeleton key={i} />
      ))}
    </div>
  );
}

/** Mirrors the filter <form> on the list pages: a Card of control-height boxes. */
export function FilterBarSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <Card className="p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: fields }, (_, i) => (
          <Skeleton key={i} className="h-[38px]" />
        ))}
      </div>
    </Card>
  );
}

/** A real <table> so the skeleton's column rhythm matches the loaded one. */
export function TableSkeleton({
  cols,
  rows = 8,
}: {
  cols: number;
  rows?: number;
}) {
  return (
    <Table>
      <thead>
        <tr>
          {Array.from({ length: cols }, (_, c) => (
            <Th key={c}>
              <Skeleton className="h-3 w-16" />
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }, (_, c) => (
              <Td key={c}>
                <Skeleton
                  className={cn("h-4", CELL_W[(r + c * 3) % CELL_W.length])}
                />
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** The shape almost every list route loads into: header, filters, table. */
export function ListPageSkeleton({
  cols,
  rows = 8,
  filters = 6,
  action = true,
}: {
  cols: number;
  rows?: number;
  filters?: number;
  action?: boolean;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeaderSkeleton action={action} />
      {filters > 0 && <FilterBarSkeleton fields={filters} />}
      <Card>
        <TableSkeleton cols={cols} rows={rows} />
        <div className="flex items-center justify-between px-5 py-3">
          <Skeleton className="h-3 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-28" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4">
        {Array.from({ length: lines * 2 }, (_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1.5 h-4 w-24" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** new/edit routes: header, then Cards of labelled controls. */
export function FormPageSkeleton({
  sections = 2,
  fields = 8,
  header = true,
}: {
  sections?: number;
  fields?: number;
  /** Off inside a route modal, which draws the title itself. */
  header?: boolean;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {header && <PageHeaderSkeleton action={false} />}
      {Array.from({ length: sections }, (_, i) => (
        <Card key={i}>
          <div className="px-5 pt-4 pb-1">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="grid grid-cols-2 gap-4 px-5 pb-5 md:grid-cols-4">
            {Array.from({ length: fields }, (_, f) => (
              <div key={f}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-1.5 h-[38px]" />
              </div>
            ))}
          </div>
        </Card>
      ))}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}

/** Detail routes: title block, then the two-column fact/side layout. */
export function DetailPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={4} />
        </div>
        <div className="space-y-4">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    </div>
  );
}


/* ── RingProgress — the reference's donut, pure SVG ───────────────── */
export function RingProgress({
  pct,
  size = 120,
  stroke = 12,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
