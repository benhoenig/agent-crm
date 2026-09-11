"use client";

/* The record's history: a comment log where each entry is tagged with the kind
   of work it was. Ported from the Klaichan CRM (Ben, 2026-08-30) and mounted
   on both the lead and the listing drawer.

   THE TAG IS THE WHOLE POINT. A note reading "ไปดูห้องกับเจ้าของ" is prose;
   the same note tagged Owner Visit is a number on the monthly scoreboard. The
   alternative — inferring the kind from the wording later — was considered in
   Klaichan and rejected there: a KPI built on guessed text is worse than no
   KPI. So the composer asks, once, with the usual kind for this surface
   already selected, and the common case stays type-and-send.

   ONLY THIS SIDE'S KINDS ARE OFFERED. The listing sees owner work, the lead
   sees buyer work. Klaichan's live data is the argument: an Owner Visit filed
   against a buyer and an Appoint against a listing, neither recoverable from
   the prose, both quietly wrong in the count.

   CHIPS WRAP, THEY DO NOT SCROLL. Klaichan learned this the expensive way —
   a horizontally scrolling row inside a narrow drawer hid Nego, Close and Win
   behind an invisible swipe, and Cream reported them as missing features for
   weeks. This drawer is 36rem; the chips wrap. */

import { useState, useTransition } from "react";
import { Ban, Check, LoaderCircle, Send, Undo2 } from "lucide-react";
import { Dot, Pill } from "@/components/ui";
import { RECAP_TONE, toneFor } from "@/lib/labels";
import { activityStamp } from "@/lib/format";
import {
  logActivity,
  setActivityKind,
  setActivityVoided,
} from "@/app/(app)/activity-actions";
import type { ActivityEntry, ActivitySide } from "@/lib/repo/activities";

export function ActivityLog({
  side,
  recordId,
  entries,
  categories,
  defaultKind,
  today,
  placeholder,
}: {
  side: ActivitySide;
  recordId: string;
  entries: ActivityEntry[];
  /** This side's kinds, in picklist order. */
  categories: string[];
  /**
   * Preselected — the thing this surface logs most often.
   *
   * NULL WHEN THE VIEWER DOES NOT OWN THIS RECORD, and that is the whole
   * reason it is nullable (Ben, 2026-09-11). A tagged entry is a claim of
   * SALES WORK: it lands on the monthly scoreboard under whoever wrote it,
   * and it resets the record's follow clock — lastCountedDate() asks for the
   * newest counted entry on the RECORD, not per person. So listing support
   * leaving "ไม่มีรูป โพสต์ไม่ได้" on an agent's listing, with Owner Talk
   * still selected because it always was, credited support with owner work
   * AND took an overdue listing off that agent's ติดตามวันนี้ queue. Nobody
   * called the owner; the queue just stopped saying so.
   *
   * Untagged is the honest default for a message about someone else's record.
   * Tagging stays one click away for the case where they really did the work.
   */
  defaultKind?: string | null;
  /** Today in Asia/Bangkok, from the server — see activityStamp(). */
  today: string;
  placeholder: string;
}) {
  // No default asked for → a plain note. Falling through to categories[0]
  // here (as this did before the prop went nullable) would put a tag back on
  // by a different route and undo the whole point of passing null.
  const initial =
    defaultKind == null
      ? null
      : // Fall back to the first offered kind if the usual one was archived or
        // re-scoped in Settings; an unpickable default would make the composer
        // impossible to send as anything but a note.
        categories.includes(defaultKind)
        ? defaultKind
        : (categories[0] ?? null);

  const [kind, setKind] = useState<string | null>(initial);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    const text = note.trim();
    if (!text || pending) return;
    setError(null);
    start(async () => {
      try {
        await logActivity(side, recordId, kind, text);
        setNote("");
        setKind(initial); // back to this surface's usual kind
      } catch (e) {
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  };

  return (
    <div className="px-5 pb-5">
      {categories.length === 0 ? (
        /* Every kind for this side was archived or re-scoped. A composer with
           nothing to pick would file everything as a note, which is how the
           scoreboard quietly goes to zero — so it says what is wrong and
           where to fix it. */
        <p className="rounded-ctl bg-warn-soft px-3 py-2 text-xs text-warn">
          ยังไม่มีประเภทงานสำหรับ{side === "lead" ? "ลูกค้า" : "ทรัพย์"} —
          ตั้งค่าได้ที่ ตั้งค่า → รายการตัวเลือก → ประเภทกิจกรรม
        </p>
      ) : (
        <div className="flex flex-col gap-2 border-b border-line pb-4">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const on = c === kind;
              return (
                <button
                  key={c}
                  type="button"
                  // Tapping the selected chip clears it and the entry saves as
                  // a plain note. Untagging is deliberately an extra click.
                  onClick={() => setKind((cur) => (cur === c ? null : c))}
                  aria-pressed={on}
                  title={on ? "กดอีกครั้งเพื่อบันทึกเป็นโน้ตธรรมดา" : undefined}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold transition-colors ${
                    on
                      ? "bg-accent text-accent-ink"
                      : "bg-surface-3 text-ink-2 hover:text-ink"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* Says what an untagged entry becomes. Without it a cleared chip row
              looks like the tap simply failed to register. */}
          {kind === null && (
            <p className="text-[0.7rem] text-ink-3">
              ไม่ได้เลือกประเภท — บันทึกเป็นโน้ตธรรมดา ไม่นับในผลงาน
              และไม่นับเป็นการติดตาม
            </p>
          )}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            rows={2}
            placeholder={placeholder}
            className="w-full resize-y rounded-ctl border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          {error && <p className="text-[0.72rem] text-bad">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={!note.trim() || pending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[0.78rem] font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {pending ? (
              <LoaderCircle size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
            บันทึก
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="pt-4 text-sm text-ink-3">
          ยังไม่มีประวัติ — บันทึกสิ่งที่ทำไปจากช่องด้านบน
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <Entry key={e.id} entry={e} categories={categories} today={today} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One row, plus the two corrections it allows.

    Cream's complaint on the same log was "ลงผิดแล้วลบไม่ได้", and there are
    two different mistakes hiding in it:

      wrong kind    the work happened, filed as the wrong thing → re-tag it
      wrong entry   it did not happen here at all → withdraw it

    Withdrawing strikes the row through and takes it out of every count while
    leaving it on the page, because a number that dropped needs something a
    person can point at. */
function Entry({
  entry,
  categories,
  today,
}: {
  entry: ActivityEntry;
  categories: string[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const stamp = activityStamp(entry.date, entry.createdAt, today);

  const refile = (k: string | null) => {
    setOpen(false);
    if (k === entry.category) return;
    start(async () => {
      await setActivityKind(entry.id, k);
    });
  };

  return (
    <li className="group flex items-start gap-3 py-3">
      {/* Day over clock time, stacked: the drawer is 36rem and one line of
          "15 ส.ค. 2569 14:32" pushes the note text into a gutter. The time is
          absent on imported history, which never recorded one. */}
      <span className="num w-20 shrink-0 pt-0.5 text-xs leading-tight text-ink-3">
        {stamp.day}
        {stamp.time && (
          <span className="block text-[0.68rem] text-ink-3/70">
            {stamp.time}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              disabled={pending || entry.voided}
              title={
                entry.voided
                  ? "รายการที่ยกเลิกแล้ว แก้ประเภทไม่ได้"
                  : "ลงผิดประเภท — กดเพื่อแก้"
              }
              className={`inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 text-sm font-medium transition-colors ${
                entry.voided ? "opacity-60" : "hover:bg-surface-3"
              }`}
            >
              <Dot
                tone={entry.category ? "accent" : "muted"}
                label={entry.category ?? "โน้ต"}
              />
            </button>

            {open && (
              <>
                <span
                  className="fixed inset-0 z-40"
                  onClick={() => setOpen(false)}
                />
                <span className="absolute left-0 top-6 z-50 flex w-max max-w-[240px] flex-col gap-0.5 rounded-card border border-line-strong bg-surface p-1.5 shadow-xl">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => refile(c)}
                      className="flex items-center gap-2 rounded-ctl px-2.5 py-1.5 text-left text-[0.78rem] transition-colors hover:bg-accent-soft"
                    >
                      <span className="flex-1">{c}</span>
                      {c === entry.category && (
                        <Check size={11} className="text-accent-text" />
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => refile(null)}
                    className="flex items-center gap-2 rounded-ctl px-2.5 py-1.5 text-left text-[0.78rem] text-ink-2 transition-colors hover:bg-accent-soft"
                  >
                    <span className="flex-1">โน้ตธรรมดา</span>
                    {entry.category === null && (
                      <Check size={11} className="text-accent-text" />
                    )}
                  </button>
                </span>
              </>
            )}
          </span>

          <span className="text-xs text-ink-3">{entry.agentName ?? "—"}</span>
          {entry.recap && (
            <Pill tone={toneFor(RECAP_TONE, entry.recap)}>{entry.recap}</Pill>
          )}

          <span className="ml-auto shrink-0">
            {pending && (
              <LoaderCircle size={12} className="animate-spin text-ink-3" />
            )}
            {!pending && entry.voided && (
              <button
                type="button"
                onClick={() =>
                  start(async () => {
                    await setActivityVoided(entry.id, false);
                  })
                }
                title="เอากลับมานับใหม่"
                className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[0.65rem] font-semibold text-ink-2 transition-colors hover:text-accent-text"
              >
                <Undo2 size={10} /> ยกเลิกแล้ว
              </button>
            )}
            {!pending && !entry.voided && (
              <button
                type="button"
                onClick={() =>
                  start(async () => {
                    await setActivityVoided(entry.id, true);
                  })
                }
                aria-label="ยกเลิกรายการนี้"
                title="ลงผิด — ยกเลิกรายการนี้ (ไม่นับในตัวเลข แต่ยังเห็นในประวัติ)"
                className="grid h-5 w-5 place-items-center rounded-full text-ink-3 opacity-0 transition-opacity hover:bg-bad-soft hover:text-bad focus:opacity-100 group-hover:opacity-100"
              >
                <Ban size={11} />
              </button>
            )}
          </span>
        </div>

        {entry.remark && (
          <p
            className={`pt-0.5 text-sm whitespace-pre-wrap ${
              entry.voided ? "text-ink-3 line-through" : "text-ink-2"
            }`}
          >
            {entry.remark}
          </p>
        )}
      </div>
    </li>
  );
}
