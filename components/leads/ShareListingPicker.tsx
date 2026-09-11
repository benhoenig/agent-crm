"use client";

/* ส่งทรัพย์ให้ลูกค้า — pick the listings a share link will carry (Ben,
   2026-09-11: "ควรเป็น dropdown search multi select").

   WHAT IT REPLACES, and why the old one could not simply be made taller. The
   card rendered one checkbox per row from listingOptions(viewer, 100) inside a
   224px scroller. Two things were wrong with that and only one of them was
   visible:

     · 1,493 listings are shareable. The call returned the 100 most recently
       touched, so the other 1,393 were not merely inconvenient to reach, they
       were UNREACHABLE — there was no control that could express them. A sales
       agent looking for a unit they listed in June scrolled a list that never
       contained it and concluded the CRM had lost it.
     · a checkbox labelled "The Line Asoke-Ratchada" tells you nothing about
       WHICH unit. Same project, four units, four identical labels.

   So: type to search the whole book (server-side, lib/repo/leads.ts →
   shareableListings), and every row carries the code, beds/baths, size and
   price that tell two units in one project apart.

   THE FORM CONTRACT IS UNCHANGED. Chosen rows post as hidden inputs named
   `listingIds`, which is exactly what createShare already reads via
   fd.getAll("listingIds") — and it still re-checks every id against
   listingScope server-side. This component is presentation; it is not a
   permission boundary and must never be treated as one. */

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Search, X } from "lucide-react";
import { lookupShareableListings } from "@/app/(app)/leads/actions";
import type {
  ShareableListing,
  ShareableListingPage,
} from "@/lib/repo/leads";
import { bahtShort, formatNum } from "@/lib/format";

/** "2 นอน · 2 น้ำ · 45 ตร.ม. · 4.2 ล้าน" — the line that separates one unit
    in a project from the next one. Every part is optional because the import
    left plenty of rows half-filled, and a row of bare separators reads worse
    than a short line. */
function specLine(l: ShareableListing): string {
  const price = l.askingPrice ?? l.rentalPrice;
  return [
    l.propertyType,
    l.bed != null ? `${l.bed} นอน` : null,
    l.bath != null ? `${l.bath} น้ำ` : null,
    l.usableSqm ? `${formatNum(l.usableSqm)} ตร.ม.` : null,
    price ? bahtShort(Number(price)) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function labelOf(l: ShareableListing): string {
  return l.listingName ?? l.legacyCode ?? "(ไม่มีชื่อ)";
}

export function ShareListingPicker({
  initial,
}: {
  /** The first page, rendered on the server so the box opens on something
      rather than on a spinner. Same shape and same query the search returns. */
  initial: ShareableListingPage;
}) {
  const [picked, setPicked] = useState<ShareableListing[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<ShareableListingPage>(initial);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Debounced search, 250ms — the same beat as the ContactPicker, so the two
     typeaheads in this app feel like one control. `live` drops a response
     that arrives after the query it belongs to has been replaced. */
  useEffect(() => {
    const term = q.trim();
    // Back to an empty box: show the server's first page again rather than
    // firing a query that would return the same rows.
    if (!term) {
      setPage(initial);
      setBusy(false);
      return;
    }
    let live = true;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const next = await lookupShareableListings(term);
        if (live) setPage(next);
      } catch {
        if (live) setPage({ rows: [], more: false });
      } finally {
        if (live) setBusy(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, initial]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    []
  );

  function toggle(l: ShareableListing) {
    setPicked((prev) =>
      prev.some((p) => p.id === l.id)
        ? prev.filter((p) => p.id !== l.id)
        : [...prev, l]
    );
  }

  // Picked rows stay in the dropdown rather than vanishing from it: a row that
  // disappears the moment you click it reads as "did that work?", and clicking
  // again is how you undo a mistake.
  const isPicked = (id: string) => picked.some((p) => p.id === id);

  return (
    <div ref={rootRef} className="space-y-2">
      {/* What createShare actually reads. Order follows the click order, which
          becomes shareListings.sortOrder — so the customer sees them in the
          order the agent chose to show them. */}
      {picked.map((l) => (
        <input key={l.id} type="hidden" name="listingIds" value={l.id} />
      ))}

      <div className="relative">
        <div className="relative">
          <Search
            size={13}
            className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setOpen(false), 120);
            }}
            autoComplete="off"
            placeholder="ค้นหาทรัพย์ — ชื่อ · รหัส · ซอย · เลขห้อง"
            className="w-full rounded-ctl border border-line bg-surface py-1.5 pr-8 pl-7 text-sm outline-none focus:border-line-strong"
          />
          {busy && (
            <LoaderCircle
              size={14}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 animate-spin text-ink-3"
            />
          )}
        </div>

        {open && (
          <ul className="absolute top-[calc(100%+4px)] left-0 z-30 max-h-80 w-full overflow-y-auto rounded-card border border-line-strong bg-surface p-1 shadow-xl">
            {page.rows.map((l) => {
              const on = isPicked(l.id);
              const spec = specLine(l);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    // The list sits under an input; without this the blur
                    // above closes it before onClick ever lands.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(l)}
                    aria-pressed={on}
                    className={`flex w-full items-start gap-2 rounded-ctl px-2.5 py-1.5 text-left transition-colors ${
                      on ? "bg-accent-soft" : "hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${
                        on
                          ? "border-transparent bg-[var(--accent)] text-white"
                          : "border-line-strong"
                      }`}
                    >
                      {on && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="truncate text-[0.82rem] font-medium">
                          {labelOf(l)}
                        </span>
                        {l.legacyCode && l.listingName && (
                          <span className="num shrink-0 text-[0.7rem] text-ink-3">
                            {l.legacyCode}
                          </span>
                        )}
                      </span>
                      {spec && (
                        <span className="block truncate text-[0.7rem] text-ink-3">
                          {spec}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 pt-0.5 text-[0.68rem] text-ink-3">
                      {l.status}
                    </span>
                  </button>
                </li>
              );
            })}
            {page.rows.length === 0 && (
              <li className="px-2.5 py-3 text-center text-xs text-ink-3">
                {q.trim()
                  ? "ไม่พบทรัพย์ที่ตรงกับคำค้นนี้"
                  : "ไม่มีทรัพย์ Active ในขอบเขตของคุณ"}
              </li>
            )}
            {/* THE LIST ADMITS WHEN IT IS NOT THE WHOLE ANSWER. A truncated
                list nobody is told about is indistinguishable from a complete
                one — which is precisely how the old 100-row version hid 1,393
                listings without anyone noticing. */}
            {page.more && (
              <li className="border-t border-line px-2.5 py-2 text-center text-[0.7rem] text-ink-3">
                แสดง {formatNum(page.rows.length)} รายการแรก —
                พิมพ์ให้ละเอียดขึ้นเพื่อดูรายการที่เหลือ
              </li>
            )}
          </ul>
        )}
      </div>

      {/* The chosen set, outside the dropdown so it survives closing it — this
          is the part the agent checks before creating the link. */}
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((l) => (
            <span
              key={l.id}
              className="flex max-w-full items-center gap-1.5 rounded-full bg-accent-soft py-1 pr-1.5 pl-2.5 text-[0.75rem] text-accent-text"
            >
              <span className="truncate font-medium">{labelOf(l)}</span>
              {l.legacyCode && l.listingName && (
                <span className="num shrink-0 text-[0.68rem] opacity-70">
                  {l.legacyCode}
                </span>
              )}
              <button
                type="button"
                onClick={() => toggle(l)}
                aria-label={`เอา ${labelOf(l)} ออก`}
                className="shrink-0 rounded-full p-0.5 hover:bg-surface-2"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-[0.7rem] text-ink-3">
        {picked.length > 0
          ? `เลือกไว้ ${formatNum(picked.length)} รายการ`
          : "พิมพ์เพื่อค้นหาทรัพย์ทั้งหมดที่คุณดูแล แล้วเลือกได้หลายรายการ"}
      </p>
    </div>
  );
}
