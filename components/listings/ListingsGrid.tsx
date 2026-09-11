"use client";

/* The /listings column registry — what a listing looks like as a grid row.

   THE REGISTRY IS THE POINT OF THE PORT. The old table showed eight columns
   because eight is what fits; a listing has nineteen facts worth comparing,
   and the ones that matter differ per person — sales wants follow dates and
   grade, support wants portal state and posted date. So every field gets a
   column and the reader hides what they do not want (saved per account, see
   lib/tables).

   FILLS, NOT PILLS, on the category columns. A column of twenty pills is
   twenty separate objects to read; a column of tinted cells is a shape you
   take in at a glance, which is the entire reason a spreadsheet beats a list
   for this job. The tone comes from the options table, so a colour changed in
   Settings lands here with no code change.

   TWO THINGS SHARE A CELL ONLY SIDE BY SIDE, never stacked: rows are a fixed
   30px and a second line would break the lattice. The name column puts the
   legacy code after the name in dim type rather than under it. */

import { SheetTable, Dim, Val } from "@/components/ui/SheetTable";
import type { Tone } from "@/components/ui";
import type { SheetColumn, TablePrefs } from "@/lib/tables";
import { daysAgoLabel, formatBaht, formatDate, formatNum } from "@/lib/format";
import { toneFor } from "@/lib/labels";

export interface ListingRow {
  id: string;
  legacyCode: string | null;
  listingName: string | null;
  zone: string | null;
  propertyType: string | null;
  listingType: string | null;
  potential: string | null;
  status: string;
  askingPrice: string | null;
  rentalPrice: string | null;
  bed: number | null;
  bath: number | null;
  usableSqm: string | null;
  agentName: string | null;
  portalPending: boolean;
  listedAt: string | null;
  postedAt: string | null;
  /** Resolved on the server: last follow → listing date → creation day. */
  followRef: string | null;
  /** Days past the follow-up SLA, or null when inside it. Computed server-side
      because the rules live in the sla_rules table and shipping them to the
      browser to recompute per row would be the same answer at more cost. */
  overdueDays: number | null;
}

/* SORT KEYS ARE THE COLUMN'S MEANING, not its text. Money and area arrive as
   numeric strings and read "12.5M" in the cell; both sort as numbers, so 9.8M
   lands before 12.5M. Dates sort on the ISO value behind "3 วันก่อน". */
const num = (v: string | number | null) =>
  v === null || v === "" ? null : Number(v);

export function ListingsGrid({
  rows,
  prefs,
  tones,
  caption,
  empty,
}: {
  rows: ListingRow[];
  prefs?: TablePrefs;
  tones: { status: Record<string, Tone>; potential: Record<string, Tone> };
  caption: string;
  empty: string;
}) {
  const columns: SheetColumn<ListingRow>[] = [
    {
      key: "name",
      label: "Listing",
      sort: (l: ListingRow) => l.listingName ?? l.legacyCode,
      locked: true,
      width: 260,
      /* NO THUMBNAIL (Ben, 2026-08-29). ListingThumb is size-11 — 44px — and
         a 44px image inside a 30px cell wins, so every listing row stood
         taller than every lead row and the two grids stopped matching. The
         image was also the one thing in the column that could not be scanned
         down; a name and its code can.

         /inventory HAD kept it, on the argument that browsing stock you do not
         own is where the picture IS the information. That page moved onto this
         grid on 2026-08-29 ("why does ทรัพย์ทั้งบริษัท ... isn't the same kind
         as the ทรัพย์"), so the thumbnail is gone there too — the row height
         is the format, and a picture small enough to fit is too small to be
         the information. It belongs back as its own hideable column if
         browsing turns out to want it; ListingThumb is still there. */
      cell: (l) => (
        <span className="flex items-baseline gap-2">
          <span className="truncate">
            {l.listingName ?? l.legacyCode ?? "(ไม่มีชื่อ)"}
          </span>
          {l.legacyCode && l.listingName && (
            <span className="num shrink-0 text-[0.68rem] text-ink-3">
              {l.legacyCode}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "status",
      label: "สถานะ",
      sort: (l: ListingRow) => l.status,
      width: 110,
      cell: (l) => <Val>{l.status}</Val>,
      fill: (l) => ({ tone: toneFor(tones.status, l.status) }),
    },
    {
      key: "potential",
      label: "เกรด",
      sort: (l: ListingRow) => l.potential,
      align: "center",
      width: 64,
      cell: (l) => <Val>{l.potential}</Val>,
      fill: (l) =>
        l.potential ? { tone: toneFor(tones.potential, l.potential) } : undefined,
    },
    {
      key: "price",
      label: "ราคา",
      sort: (l: ListingRow) => num(l.askingPrice ?? l.rentalPrice),
      align: "right",
      width: 110,
      cell: (l) => (
        <Val mono>{formatBaht(l.askingPrice ?? l.rentalPrice)}</Val>
      ),
    },
    {
      key: "zone",
      label: "โซน",
      sort: (l: ListingRow) => l.zone,
      width: 110,
      cell: (l) => <Dim>{l.zone}</Dim>,
    },
    {
      key: "propertyType",
      label: "ประเภททรัพย์",
      sort: (l: ListingRow) => l.propertyType,
      width: 110,
      cell: (l) => <Dim>{l.propertyType}</Dim>,
    },
    {
      key: "listingType",
      sort: (l: ListingRow) => l.listingType,
      label: "ขาย/เช่า",
      width: 90,
      cell: (l) => <Dim>{l.listingType}</Dim>,
    },
    {
      key: "bed",
      label: "นอน",
      sort: (l: ListingRow) => l.bed,
      align: "center",
      width: 56,
      cell: (l) => <Val mono>{l.bed}</Val>,
    },
    {
      key: "bath",
      label: "น้ำ",
      sort: (l: ListingRow) => l.bath,
      align: "center",
      width: 56,
      cell: (l) => <Val mono>{l.bath}</Val>,
    },
    {
      key: "sqm",
      label: "ตร.ม.",
      sort: (l: ListingRow) => num(l.usableSqm),
      align: "right",
      width: 72,
      cell: (l) => <Val mono>{l.usableSqm ? formatNum(l.usableSqm) : null}</Val>,
    },
    {
      key: "agent",
      label: "เซลส์",
      sort: (l: ListingRow) => l.agentName,
      width: 100,
      cell: (l) => <Dim>{l.agentName}</Dim>,
    },
    {
      key: "follow",
      label: "Follow ล่าสุด",
      // Descending here means "most overdue first", which is the only reason
      // anyone sorts this column. A row inside its SLA sorts as 0, not as its
      // date, so the breaches group together instead of interleaving with
      // whoever happens to have an old-but-fine follow date.
      sort: (l: ListingRow) => l.overdueDays ?? 0,
      width: 120,
      cell: (l) => (
        <span>
          <Dim>{l.followRef ? daysAgoLabel(l.followRef) : null}</Dim>
          {l.overdueDays !== null && l.overdueDays > 0 && (
            <span className="num pl-1.5 text-[0.68rem] font-semibold">
              +{l.overdueDays}
            </span>
          )}
        </span>
      ),
      // The SLA is not an option row, so it has no tone of its own to borrow —
      // this is the `className` escape hatch CellFill exists for.
      fill: (l) =>
        l.overdueDays !== null && l.overdueDays > 0
          ? { className: "bg-bad-soft text-bad" }
          : undefined,
    },
    {
      key: "portal",
      label: "พอร์ทัล",
      sort: (l: ListingRow) => (l.portalPending ? 1 : 0),
      align: "center",
      width: 100,
      cell: (l) => (l.portalPending ? "รออัปเดต" : <Dim>{null}</Dim>),
      fill: (l) => (l.portalPending ? { tone: "warn" } : undefined),
    },
    {
      key: "listedAt",
      label: "วันที่ลง",
      sort: (l: ListingRow) => l.listedAt,
      width: 100,
      cell: (l) => <Val mono>{l.listedAt ? formatDate(l.listedAt) : null}</Val>,
    },
    {
      key: "postedAt",
      label: "วันที่โพสต์",
      sort: (l: ListingRow) => l.postedAt,
      width: 100,
      cell: (l) => <Val mono>{l.postedAt ? formatDate(l.postedAt) : null}</Val>,
    },
    {
      key: "code",
      label: "รหัสเดิม",
      sort: (l: ListingRow) => l.legacyCode,
      width: 100,
      cell: (l) => <Val mono>{l.legacyCode}</Val>,
    },
  ];

  return (
    <SheetTable
      tableKey="listings"
      columns={columns}
      rows={rows}
      rowKey={(l) => l.id}
      href={(l) => `/listings/${l.id}`}
      prefs={prefs}
      caption={caption}
      empty={empty}
    />
  );
}
