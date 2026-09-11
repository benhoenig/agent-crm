"use client";

/* "This person is in the book twice" — find the other row and fold it in
   (Ben, 2026-09-11).

   DIRECTION IS FIXED BY THE PAGE YOU ARE ON. The contact whose page this is
   always WINS: it keeps its values, it keeps its id, and the one you pick
   here is folded into it and deleted. Letting the direction be chosen would
   read as a preference when it is actually which id every link, bookmark and
   owner-report URL in circulation already points at.

   IT SEARCHES THE WHOLE BOOK, because the action refuses anyone whose
   ownerContacts is not "all" and this card is not rendered for them. The
   scoped agent's half-view is exactly the wrong basis for deciding two people
   are one.

   THE CONFIRM NAMES THE COST. Merging cannot be undone — the loser's row is
   gone — so the panel states what moves, what is kept, and what gets written
   into the remark rather than lost, before the button appears. */

import { useEffect, useState, useTransition } from "react";
import { ArrowRight, LoaderCircle, Merge, Search, X } from "lucide-react";
import { Button, Card, CardHeader, Input } from "@/components/ui";
import { lookupContacts, mergeContacts } from "@/app/(app)/contacts/actions";
import type { ContactMatch } from "@/lib/repo/contacts";
import { formatNum } from "@/lib/format";

export function MergeContact({
  winnerId,
  winnerName,
  winner,
}: {
  winnerId: string;
  winnerName: string;
  /** The winner's current values — drives the "what will change" preview. */
  winner: {
    name: string | null;
    phone: string | null;
    lineId: string | null;
    email: string | null;
  };
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ContactMatch[]>([]);
  const [picked, setPicked] = useState<ContactMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  // Same debounce as the picker. Never offers the winner itself: merging a
  // row into itself is a no-op the action already refuses, and showing it
  // invites the click.
  useEffect(() => {
    if (picked) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const rows = await lookupContacts(term);
        if (live) setResults(rows.filter((r) => r.id !== winnerId));
      } finally {
        if (live) setBusy(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, picked, winnerId]);

  // Fields the winner is missing and the loser can supply — these get filled.
  const fills = picked
    ? (["name", "phone", "lineId", "email"] as const)
        .filter((k) => !winner[k] && picked[k])
        .map((k) => ({ k, v: picked[k] as string }))
    : [];

  // Fields where both hold a DIFFERENT value — the winner's is kept and the
  // loser's goes to the remark. Naming them is the point of this panel.
  const keeps = picked
    ? (["name", "phone", "lineId", "email"] as const)
        .filter((k) => winner[k] && picked[k] && winner[k] !== picked[k])
        .map((k) => ({ k, mine: winner[k] as string, theirs: picked[k] as string }))
    : [];

  const LABEL: Record<string, string> = {
    name: "ชื่อ",
    phone: "เบอร์โทร",
    lineId: "LINE",
    email: "อีเมล",
  };

  const moving = (picked?.listingCount ?? 0) + (picked?.leadCount ?? 0);

  return (
    <Card>
      <CardHeader
        title="รวมรายชื่อซ้ำ"
        action={
          <span className="text-xs text-ink-3">
            ถ้าลูกค้าคนนี้มีอยู่สองรายชื่อ
          </span>
        }
      />
      <div className="space-y-3 px-5 pb-5">
        {!picked ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              ค้นหารายชื่อที่ซ้ำ (ชื่อ หรือ เบอร์โทร)
              <div className="relative">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="พิมพ์เพื่อค้นหา…"
                  autoComplete="off"
                />
                {busy && (
                  <LoaderCircle
                    size={14}
                    className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-ink-3"
                  />
                )}
              </div>
            </label>
            {results.length > 0 && (
              <ul className="flex flex-col gap-1">
                {results.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(m)}
                      className="flex w-full items-baseline gap-2 rounded-ctl border border-line bg-surface-2 px-3 py-2 text-left transition-colors hover:border-line-strong"
                    >
                      <span className="truncate text-sm font-medium">
                        {m.name || "(ไม่มีชื่อ)"}
                      </span>
                      {m.phone && (
                        <span className="num shrink-0 text-xs text-ink-3">
                          {m.phone}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-ink-3">
                        {[
                          m.listingCount
                            ? `${formatNum(m.listingCount)} ทรัพย์`
                            : null,
                          m.leadCount ? `${formatNum(m.leadCount)} Lead` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "ยังไม่มีรายการ"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {q.trim().length >= 2 && !busy && results.length === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-ink-3">
                <Search size={11} /> ไม่พบรายชื่ออื่นที่ตรงกับคำค้นนี้
              </p>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-ctl border border-warn/40 bg-warn-soft px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-warn">
                {picked.name || "(ไม่มีชื่อ)"}
                {picked.phone ? ` · ${picked.phone}` : ""}
              </span>
              <ArrowRight size={14} className="shrink-0 text-warn" />
              <span className="min-w-0 flex-1 truncate font-semibold text-warn">
                {winnerName}
              </span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                aria-label="ยกเลิกการเลือก"
                className="shrink-0 text-warn/70 hover:text-warn"
              >
                <X size={14} />
              </button>
            </div>

            <ul className="space-y-1.5 text-xs text-ink-2">
              <li>
                • ทรัพย์และ Lead ทั้งหมดของ{" "}
                <b>{picked.name || "(ไม่มีชื่อ)"}</b>
                {moving > 0 ? ` (${formatNum(moving)} รายการ)` : ""} จะย้ายมาที่{" "}
                <b>{winnerName}</b>
              </li>
              {fills.length > 0 && (
                <li>
                  • เติมช่องที่ยังว่างของ <b>{winnerName}</b>:{" "}
                  {fills.map((f) => `${LABEL[f.k]} = ${f.v}`).join(" · ")}
                </li>
              )}
              {keeps.length > 0 && (
                <li>
                  • ช่องที่มีข้อมูลทั้งคู่ — เก็บของ <b>{winnerName}</b> ไว้
                  ส่วนของเดิม (
                  {keeps.map((k) => `${LABEL[k.k]}: ${k.theirs}`).join(" · ")})
                  จะถูกบันทึกไว้ในหมายเหตุ ไม่หาย
                </li>
              )}
              <li className="text-bad">
                • รายชื่อ <b>{picked.name || "(ไม่มีชื่อ)"}</b> จะถูกลบถาวร —
                ย้อนกลับไม่ได้
              </li>
            </ul>

            <div className="flex gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await mergeContacts(winnerId, picked.id);
                  })
                }
              >
                {pending ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Merge size={14} />
                )}
                รวมเป็นคนเดียว
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setPicked(null)}
              >
                ยกเลิก
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
