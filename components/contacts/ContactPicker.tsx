"use client";

/* เจ้าของทรัพย์ on a listing, ผู้ติดต่อ on a lead — the same four fields over
   the same `contacts` table, so one component (Ben, 2026-08-29).

   WHAT IT REPLACES. Three plain inputs that deduped INVISIBLY: resolveOwnerId
   normalised the phone on save, found an existing person, and linked to them
   without ever saying so. Three things went wrong with that:

     · no phone typed → no dedupe at all, so entering an existing owner by
       name alone always minted a second copy of them.
     · a match said nothing. You never learned this listing had just been
       attached to someone already holding four others.
     · on a match to someone outside your book, the fill-only-blanks rule
       DROPPED the name and LINE you had typed. The form implied it saved
       them. It did not.

   Typing in ชื่อ or เบอร์โทร now searches (lookupContacts → searchContacts,
   where the scope rule lives). Pick someone and the fields fill, a hidden
   `<prefix>Id` posts, and the save links to that exact row instead of
   guessing from the number.

   TYPING STILL WORKS ON ITS OWN. Nothing here is required: ignore the
   dropdown, type three fields, and the old phone-dedupe path runs exactly as
   before. The picker is a way to be sure, not a gate. */

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Search, X } from "lucide-react";
import { FieldRow, FieldRows, Input } from "@/components/ui";
import { lookupContacts } from "@/app/(app)/contacts/actions";
import type { ContactMatch } from "@/lib/repo/contacts";
import { formatNum } from "@/lib/format";
// Pure function, no server imports — safe on the client, and using the SAME
// canonicaliser as the save is the point: a mismatch here would stop a form
// the dedupe was about to handle correctly.
import { normalizePhone } from "@/lib/phone";

/** Loose name agreement — enough to say "same person" alongside a matching
    phone, without demanding the two were typed identically. Thai contact names
    carry คุณ / K. prefixes inconsistently and pick up stray spacing, and the
    phone has already done the identifying by the time this is asked. */
function sameName(a: string, b: string | null): boolean {
  const norm = (x: string) =>
    x.toLowerCase().replace(/^(คุณ|k\.|khun)\s*/i, "").replace(/\s+/g, "");
  const x = norm(a.trim());
  const y = norm((b ?? "").trim());
  if (!x || !y) return true; // nothing to disagree with
  return x === y || x.includes(y) || y.includes(x);
}

export interface ContactDefaults {
  name: string | null;
  phone: string | null;
  lineId: string | null;
  email: string | null;
}

export function ContactPicker({
  prefix,
  labels,
  defaults,
  withEmail = false,
  nameRequired = false,
  phoneHint,
  dedupe = false,
}: {
  /** Posts as `<prefix>Name`, `<prefix>Phone`, `<prefix>LineId`,
   *  `<prefix>Email` and the hidden `<prefix>Id` — the names the two server
   *  actions already read. */
  prefix: "owner" | "contact";
  labels: { name: string; phone: string; lineId: string; email?: string };
  defaults?: ContactDefaults | null;
  withEmail?: boolean;
  nameRequired?: boolean;
  phoneHint?: React.ReactNode;
  /**
   * CREATE FORMS ONLY — the two checks that keep a person from entering the
   * book twice (Ben, 2026-09-11).
   *
   *   on mount    a prefilled phone (an AI draft) is looked up once and the
   *               person shown, because nobody focuses a field that is
   *               already filled and the focus-driven search never fires.
   *   on submit   the typed phone is looked up. Already in the book under a
   *               name that agrees: the save goes through and says who it
   *               linked to. Under a DIFFERENT name: stopped once, because
   *               somebody has mistyped a number.
   *
   * Both key on the phone. A shared name is not evidence here — Thai
   * nicknames repeat hard, and warning on one cries wolf.
   *
   * Edit forms must not pass it. There the values are prefilled because the
   * record already has that contact, so both checks would be asking whether a
   * person might be themselves.
   */
  dedupe?: boolean;
}) {
  const d = defaults ?? null;
  const [name, setName] = useState(d?.name ?? "");
  const [phone, setPhone] = useState(d?.phone ?? "");
  const [lineId, setLineId] = useState(d?.lineId ?? "");
  const [email, setEmail] = useState(d?.email ?? "");

  const [linked, setLinked] = useState<ContactMatch | null>(null);
  const [active, setActive] = useState<"name" | "phone" | null>(null);
  const [results, setResults] = useState<ContactMatch[]>([]);
  /* Matches found by the on-mount search. Separate from `results`, which is
     the focus-driven dropdown: this one is a banner that stays put while the
     user reads the rest of the draft, rather than vanishing on blur. */
  const [suggested, setSuggested] = useState<ContactMatch[]>([]);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* One debounced search over whichever of the two fields has focus. Cancels
     on every keystroke and on unmount, and `live` drops a response that comes
     back after the query it belongs to has been replaced. */
  useEffect(() => {
    if (linked || !active) {
      setResults([]);
      return;
    }
    const q = (active === "name" ? name : phone).trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const rows = await lookupContacts(q);
        if (live) setResults(rows);
      } finally {
        if (live) setBusy(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [active, name, phone, linked]);

  /* THE AI PATH'S CHECK, and the only one that fires without a focus.

     A pasted LINE message becomes a draft with the name and phone already in
     these fields, and the search above never runs on it: `active` is null
     until someone clicks a field, and on a form that is already filled there
     is no reason to. So the route the intake desk uses most was the one route
     that never said "you already have this person".

     BY PHONE ONLY, for the same reason as the save-time check below. An
     earlier version searched the name too, which on this book means แน็ต
     raises seven strangers and คุณแป้ง eight. A banner that is usually a
     false alarm trains the desk to scroll past it.

     Runs exactly once. Re-searching as the user then edits is the
     focus-driven search's job, and doing both would fight it. */
  const suggestedOnce = useRef(false);
  useEffect(() => {
    if (!dedupe || suggestedOnce.current) return;
    const typed = normalizePhone(d?.phone ?? null);
    if (typed === null) return;
    suggestedOnce.current = true;

    let live = true;
    (async () => {
      const rows = await lookupContacts(typed).catch(() => []);
      if (!live) return;
      const hit = rows.find((r) => r.phone === typed);
      setSuggested(hit ? [hit] : []);
    })();
    return () => {
      live = false;
    };
  }, [dedupe, d?.phone]);

  /* THE SAVE-TIME CHECK — keyed on the PHONE, not the name.

     IT WAS THE OTHER WAY ROUND AND THAT WAS WRONG (Ben, 2026-09-11: "in order
     for the app to detect duplication both the name and phone must be the
     same, because same name is normal"). He is right, and the book proves it:
     แน็ต is seven contacts with seven different numbers, คุณแป้ง is eight with
     five. Thai nicknames repeat, so a name match is not evidence of anything.
     Stopping on one meant interrupting almost every genuine new customer, and
     a warning that is usually wrong is one people learn to click past.

     The phone is the identity. So:

       phone matches, name agrees    the person is already here. Not a stop —
                                     the save links to them on its own — but
                                     say so, because "this is a returning
                                     customer" is the thing worth knowing.
       phone matches, name differs   STOP. Either the number was mistyped into
                                     somebody else's record, or one of the two
                                     names is wrong. Both need a human.
       name only                     nothing. Normal.

     Capture phase, on the enclosing <form>: this component does not own the
     form, and reaching it through the DOM is what lets one picker guard both
     the lead form and the listing form without either knowing. */
  const rootRef = useRef<HTMLDivElement>(null);
  const clearedRef = useRef(false);
  const [blocked, setBlocked] = useState<ContactMatch[] | null>(null);
  /** Phone matched and the name agrees — informational, never a stop. */
  const [sameAs, setSameAs] = useState<ContactMatch | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!dedupe) return;
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const onSubmit = (e: Event) => {
      // Already answered, or the user named an exact row — nothing to ask.
      if (clearedRef.current || linked) return;
      // No number means no evidence. The name alone never stops a save.
      const typed = normalizePhone(phone);
      if (typed === null) return;

      e.preventDefault();
      e.stopPropagation();
      setChecking(true);
      (async () => {
        // Search BY THE NUMBER. searchContacts runs its exact-phone arm
        // unscoped, so this finds the person even when they belong to another
        // agent's book — which is the case a scoped viewer most needs and can
        // least see for themselves.
        const rows = await lookupContacts(typed).catch(() => []);
        const hit = rows.find((r) => r.phone === typed) ?? null;
        setChecking(false);

        if (!hit) {
          clearedRef.current = true;
          form.requestSubmit();
          return;
        }

        // Same number AND the names agree: this is them. Let the save through
        // — it links rather than duplicates — and say who it linked to.
        if (sameName(name, hit.name)) {
          setSameAs(hit);
          clearedRef.current = true;
          form.requestSubmit();
          return;
        }

        // Same number, different name. Somebody has mistyped something.
        setBlocked([hit]);
      })();
    };

    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, [dedupe, linked, name, phone]);

  /* Editing either field after being stopped retires the answer: it was about
     the name that was there when save was pressed. The next press asks again
     with whatever is there then — clearedRef is untouched, so an explicit
     "different person" still stands. */
  useEffect(() => {
    setBlocked(null);
  }, [name, phone]);

  /** "Yes, this really is a different person" — let the next submit pass. */
  function saveAsNew() {
    clearedRef.current = true;
    setBlocked(null);
    rootRef.current?.closest("form")?.requestSubmit();
  }

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    []
  );

  function pick(m: ContactMatch) {
    setLinked(m);
    setSuggested([]);
    setName(m.name ?? "");
    setPhone(m.phone ?? "");
    setLineId(m.lineId ?? "");
    setEmail(m.email ?? "");
    setActive(null);
    setResults([]);
  }

  /* Unlinking KEEPS the filled values. They are a decent starting point, and
     the save falls back to the phone dedupe from here — which is the same
     answer, just reached the old way. */
  function unlink() {
    setLinked(null);
  }

  // A person you cannot normally see is shown, and linkable, but not
  // editable: writing to their record is what contactScope forbids, and a
  // field that silently discards what you type is worse than one you cannot
  // type into.
  const frozen = linked?.outsideScope === true;

  const dropdown = (field: "name" | "phone") =>
    active === field && !linked && results.length > 0 ? (
      <ul className="absolute top-[calc(100%+4px)] left-0 z-30 max-h-56 w-full overflow-y-auto rounded-card border border-line-strong bg-surface p-1 shadow-xl">
        {results.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              // The rows live inside a <label>; without this the click moves
              // focus to the input and blur closes the list before onClick.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(m)}
              className="flex w-full items-baseline gap-2 rounded-ctl px-2.5 py-1.5 text-left transition-colors hover:bg-surface-2"
            >
              <span className="truncate text-[0.82rem] font-medium">
                {m.name || "(ไม่มีชื่อ)"}
              </span>
              {m.phone && (
                <span className="num shrink-0 text-[0.72rem] text-ink-3">
                  {m.phone}
                </span>
              )}
              <span className="ml-auto shrink-0 text-[0.7rem] text-ink-3">
                {m.outsideScope
                  ? "ตรงเบอร์โทร"
                  : [
                      m.listingCount ? `${formatNum(m.listingCount)} ทรัพย์` : null,
                      m.leadCount ? `${formatNum(m.leadCount)} Lead` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  const searchable = (field: "name" | "phone") => ({
    onFocus: () => setActive(field),
    onBlur: () => {
      // Long enough for a click on a result to land; mousedown above stops
      // the blur firing at all in that case, so this only closes real exits.
      blurTimer.current = setTimeout(() => setActive(null), 120);
    },
    readOnly: frozen,
    autoComplete: "off" as const,
  });

  /* Which banner to show, if any. The blocked one outranks the mount-time
     suggestion: it is the same question asked at the moment it finally
     matters, and stacking both would ask it twice. */
  const banner = blocked ?? (suggestDismissed ? null : suggested.length ? suggested : null);
  const isBlocking = blocked !== null;

  return (
    <div ref={rootRef}>
    <FieldRows>
      {/* Hidden until something is picked. An empty value would post as "" and
          read the same as absent, but sending nothing is plainer. */}
      {linked && <input type="hidden" name={`${prefix}Id`} value={linked.id} />}

      {/* Confirmed repeat customer: the number is already in the book under a
          name that agrees, so the save was let through and resolveContactId /
          resolveOwnerId will attach this record to that same person. Shown
          because "we already know them" is the fact worth having — not as a
          warning, because nothing went wrong. */}
      {sameAs && !linked && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-accent-soft px-5 py-2 text-[0.75rem] text-accent-text">
          <Check size={13} className="shrink-0" />
          <span className="font-semibold">
            ลูกค้าเดิม: {sameAs.name || "(ไม่มีชื่อ)"}
          </span>
          <span className="text-ink-3">
            {[
              sameAs.listingCount
                ? `${formatNum(sameAs.listingCount)} ทรัพย์`
                : null,
              sameAs.leadCount ? `${formatNum(sameAs.leadCount)} Lead` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "— ผูกกับรายชื่อเดิมให้แล้ว"}
          </span>
        </div>
      )}

      {/* The submit guard swallowed the press and is off asking the server.
          Without this the save button looks broken for the length of a query:
          the form did not submit and nothing said why. */}
      {checking && (
        <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-5 py-2 text-[0.75rem] text-ink-3">
          <LoaderCircle size={12} className="animate-spin" />
          กำลังตรวจสอบรายชื่อซ้ำ…
        </div>
      )}

      {/* "You may already have this person." A PROMPT, never a block — the
          entry may genuinely be a new person who shares a name, so ข้าม /
          บันทึกเป็นคนใหม่ saves exactly as before and the phone index still
          catches an exact repeat on its own. */}
      {!linked && banner && (
        <div className="border-b border-warn/30 bg-warn-soft px-5 py-2.5">
          <div className="flex items-start gap-2">
            <Search size={13} className="mt-0.5 shrink-0 text-warn" />
            <p className="min-w-0 flex-1 text-[0.75rem] font-semibold text-warn">
              {isBlocking
                ? "เบอร์นี้มีอยู่แล้ว แต่คนละชื่อ — พิมพ์เบอร์ผิด หรือเป็นคนเดิมที่ชื่อไม่ตรง?"
                : "เบอร์นี้เคยเข้าระบบแล้ว — เลือกเพื่อผูกกับรายชื่อเดิม"}
            </p>
            {!isBlocking && (
              <button
                type="button"
                onClick={() => setSuggestDismissed(true)}
                aria-label="ข้าม"
                className="shrink-0 text-warn/70 hover:text-warn"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {/* Five, not all nine. A vague name off an AI draft ("ลูกค้า") can
              fill the whole limit with people who merely share a syllable;
              the count above is the honest total, and anything past the first
              few is better found by typing in the field below. */}
          <ul className="flex flex-col gap-1 pt-2">
            {banner.slice(0, 5).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m)}
                  className="flex w-full items-baseline gap-2 rounded-ctl bg-surface px-2.5 py-1.5 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="truncate text-[0.82rem] font-medium">
                    {m.name || "(ไม่มีชื่อ)"}
                  </span>
                  {m.phone && (
                    <span className="num shrink-0 text-[0.72rem] text-ink-3">
                      {m.phone}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[0.7rem] text-ink-3">
                    {m.outsideScope
                      ? "ตรงเบอร์โทร"
                      : [
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
          {/* The way past the stop. Worded as the question actually being
              asked — "is the number right?" — rather than as an escape
              ("save anyway"). Saving links to the row above, because the
              phone is unique and the save resolves on it; the disagreement
              was only ever about the name. */}
          {isBlocking && (
            <button
              type="button"
              onClick={saveAsNew}
              className="mt-2 w-full rounded-ctl bg-surface px-2.5 py-1.5 text-[0.75rem] font-semibold text-warn transition-colors hover:bg-surface-2"
            >
              เบอร์ถูกแล้ว — บันทึกต่อ
            </button>
          )}
        </div>
      )}

      {linked && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-accent-soft px-5 py-2 text-[0.75rem] text-accent-text">
          <Check size={13} className="shrink-0" />
          <span className="font-semibold">
            ผูกกับรายชื่อเดิม: {linked.name || "(ไม่มีชื่อ)"}
          </span>
          {frozen ? (
            <span className="text-ink-3">
              — รายชื่อนี้อยู่นอกรายการของคุณ แก้ไขข้อมูลไม่ได้จากที่นี่
            </span>
          ) : (
            <span className="text-ink-3">— แก้ไขข้อมูลด้านล่างได้</span>
          )}
          <button
            type="button"
            onClick={unlink}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold hover:bg-surface-2"
          >
            <X size={12} /> ยกเลิกการเลือก
          </button>
        </div>
      )}

      <FieldRow label={labels.name}>
        <div className="relative">
          <Input
            name={`${prefix}Name`}
            required={nameRequired}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="พิมพ์เพื่อค้นหารายชื่อเดิม"
            {...searchable("name")}
          />
          {active === "name" && busy && (
            <LoaderCircle
              size={14}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 animate-spin text-ink-3"
            />
          )}
          {dropdown("name")}
        </div>
      </FieldRow>

      <FieldRow
        label={labels.phone}
        hint={phoneHint ?? "พิมพ์เบอร์เต็มเพื่อค้นหารายชื่อเดิมทั้งบริษัท"}
      >
        <div className="relative">
          <Input
            name={`${prefix}Phone`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="num"
            {...searchable("phone")}
          />
          {active === "phone" && busy && (
            <LoaderCircle
              size={14}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 animate-spin text-ink-3"
            />
          )}
          {dropdown("phone")}
        </div>
      </FieldRow>

      <FieldRow label={labels.lineId}>
        <Input
          name={`${prefix}LineId`}
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          readOnly={frozen}
        />
      </FieldRow>

      {withEmail && (
        <FieldRow label={labels.email ?? "อีเมล"}>
          <Input
            type="email"
            name={`${prefix}Email`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={frozen}
          />
        </FieldRow>
      )}

      {/* The one-line explanation of a control that looks like three plain
          inputs until you type in it. */}
      {!linked && (
        <p className="flex items-center gap-1.5 px-5 py-1.5 text-[0.7rem] text-ink-3">
          <Search size={11} className="shrink-0" />
          พิมพ์ชื่อหรือเบอร์โทรเพื่อเลือกรายชื่อเดิม — ถ้าไม่เลือก
          ระบบจะจับคู่จากเบอร์โทรให้อัตโนมัติ
        </p>
      )}
    </FieldRows>
    </div>
  );
}
