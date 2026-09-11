"use client";

/* กิจกรรมวันนี้ — what actually got done today, and the quick way to add to it.

   MOVED HERE FROM /today (Ben, 2026-08-28), where it was a seven-field form
   sitting under the planner on a page that no longer has a nav entry. It is
   the same table and the same columns; what changed is that it now sits
   directly under the plan, because the two are one loop: you tick a planned
   task and the row appears here, or you log something that was never planned
   and it lands in the same list.

   THE LIST IS SHARED STATE, OWNED BY PlanColumn. Ticking a task writes an
   `actions` row from inside usePlanner, so if this card owned its own list
   the row would be invisible until a reload — and the whole point of putting
   them adjacent is that you SEE the plan feed the log.

   THE FORM IS GONE (Ben, 2026-08-30). This card used to carry its own
   category/quantity/hours composer, which meant `actions` had two doors: tick
   a planned task, or type it here. One door now — you add it to the plan and
   tick it, and the plan's quick-add carries the category and the count so
   that is still two keystrokes and a click. What went with the form:

     the whole composer   and `logActivity`, its server action
     hours                nothing ever scored it; every counter in the app is
                          count() over rows. Old rows keep theirs and still
                          render below, because deleting history to tidy an
                          input would be a lie about what happened.

   SO WHY KEEP IT AT ALL (Ben asked, 2026-08-30). Because it is not a second
   view of the plan — `actions` has three live writers and only one of them is
   a task:

     completeTask    ticking a planned task, the main door
     logActivity     writing on a lead's or a listing's own timeline (0027) —
                     never a task, and now the ONLY way a follow happens

   The second never appears in the plan at all, so this is the only place the
   day adds up. And it is the only UNDO for the first: un-ticking a task that
   logged an activity is refused on purpose, and removing the row here is what
   un-ticks it. Take this card away and that work becomes permanent.

   A ROW FROM A RECORD CANNOT BE REMOVED HERE, and that is deliberate rather
   than an omission — deleteActivity refuses anything carrying a lead or
   listing id. Those are withdrawn on the record itself, where the history
   they belong to is, and where withdrawing can recompute that record's SLA
   clock in the same breath.

   REMOVE, BUT NO EDIT (Ben, 2026-08-29: "there's no way to undo บันทึกกิจกรรม
   on the dashboard page"). This card shipped append-only, on the argument
   that a mistake is corrected by logging the truth rather than rewriting the
   record. That argument holds for a ledger and fails here: there is no
   negative Show to log, so a mistyped row was permanent and the tally was
   simply wrong from then on. Each row now carries a ✕ — see `deleteActivity`
   for the three limits that keep this a correction and not an editing tool.

   ✕ ASKS FIRST, INLINE. A confirm dialog for one row of a day's tally is
   heavier than the mistake, but a single click that silently drops a row from
   a list you are scanning is how you lose one without noticing. So the ✕
   turns into a ลบ/ยกเลิก pair in place, and nothing moves until you answer.

   NO EDIT, THOUGH. Removing and re-logging costs two clicks more and leaves
   the honest thing behind — one row, right — where an in-place edit would
   need every field wired twice for a case that happens once a week. */

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { PlanCard } from "./Bits";
import { Dot } from "@/components/ui";
import { RECAP_TONE, toneFor } from "@/lib/labels";
import { formatNum } from "@/lib/format";
import { deleteActivity } from "@/app/(app)/plan/actions";
import type { DayActivity } from "@/lib/plan";

export function ActivityLogCard({
  activities,
  onRemoved,
}: {
  activities: DayActivity[];
  /** The row is gone from the database. `taskId` is the plan task that wrote
      it, already un-ticked server-side — the caller clears its checkbox. */
  onRemoved: (id: string, taskId: string | null) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function remove(id: string) {
    setError(null);
    start(async () => {
      const res = await deleteActivity(id);
      if (!res.ok) {
        setError(
          res.reason === "linked"
            ? "รายการติดตามลบไม่ได้ — วันที่ติดตามล่าสุดของรายการถูกอัปเดตไปแล้ว"
            : "ลบไม่สำเร็จ — รายการนี้ไม่ใช่ของวันนี้"
        );
        setConfirming(null);
        return;
      }
      setConfirming(null);
      onRemoved(id, res.taskId);
    });
  }

  return (
    <PlanCard>
      <div className="pb-2">
        <h2 className="text-sm font-semibold">กิจกรรมวันนี้</h2>
        <p className="text-[0.7rem] text-ink-3">
          {activities.length === 0
            ? "ทุกกิจกรรมของวันนี้มารวมที่นี่ — จากการติ๊กงาน จากการติดตาม และจากหน้า Lead"
            : `${formatNum(activities.length)} รายการวันนี้ · กด ✕ เพื่อลบและยกเลิกติ๊ก`}
        </p>
      </div>

      {/* Removal is the only thing here that can fail — a follow-up, or a row
          that has rolled over to yesterday. */}
      {error && <p className="pb-2 text-[0.72rem] text-bad">{error}</p>}

      {activities.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {activities.map((a) => (
            <li
              key={a.id}
              className="group flex items-baseline gap-2 py-1.5"
              // The ✕ is opacity-0 until hover, so the list reads as a tally
              // rather than as a row of delete buttons. focus-within keeps it
              // reachable by keyboard, where there is no hover to have.
            >
              <span className="text-[0.8rem] font-medium">{a.category}</span>
              {(a.quantity !== null || a.hours !== null) && (
                <span className="num shrink-0 text-[0.7rem] text-ink-3">
                  {a.quantity !== null && `×${formatNum(a.quantity)}`}
                  {a.quantity !== null && a.hours !== null && " · "}
                  {a.hours !== null && `${formatNum(a.hours)} ชม.`}
                </span>
              )}
              {a.remark && (
                <span className="min-w-0 flex-1 truncate text-[0.72rem] text-ink-3">
                  {a.remark}
                </span>
              )}
              {/* ONE trailing group, not two `ml-auto` siblings: two of them
                  split the free space between the recap dot and the ✕ and
                  leave a gap in the middle of the row. */}
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {a.recap && (
                  <Dot tone={toneFor(RECAP_TONE, a.recap)} label={a.recap} />
                )}
                {/* A follow-up gets no ✕ at all rather than one that explains
                    itself only after being clicked — it stamped a record, and
                    that stamp cannot be taken back. */}
                {!a.linked &&
                  (confirming === a.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => remove(a.id)}
                        disabled={pending}
                        className="text-[0.72rem] font-semibold text-bad hover:underline disabled:opacity-50"
                      >
                        ลบ
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="text-[0.72rem] text-ink-3 hover:underline"
                      >
                        ยกเลิก
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(a.id)}
                      aria-label={`ลบกิจกรรม ${a.category}`}
                      className="rounded-full p-0.5 text-ink-3 opacity-0 transition-opacity hover:text-bad focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PlanCard>
  );
}
