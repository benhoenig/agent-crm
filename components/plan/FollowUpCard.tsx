"use client";

/* ติดตามวันนี้ — the records that are past their follow-up SLA.

   PORTED FROM the Klaichan CRM card, 2026-08-28, replacing the two SLA tables
   (ตามเจ้าของทรัพย์ + ตาม Lead) that used to sit in this slot. Same work, a
   third of the height, and it gained the verb the tables never had: you can
   put a call on today's plan instead of only ticking it off.

   THIS IS NOT A TASK LIST, and the difference is the whole design. Every row
   is DERIVED — a live comparison of the record's last follow against its SLA
   window (lib/repo/today.ts getFollowUps). Nothing is stored, so nothing has
   to be cleaned up: a row leaves because the RECORD moved, not because
   anything was marked.

   That is why these are not simply written into the plan as tasks each
   morning. Overdue-ness is a query result that stops being true the moment a
   follow-up lands; a task's `done` is a fact somebody wrote down. Copying one
   into the other lets them drift in both directions — and with a few hundred
   overdue records against a plan that shows one day's work, the auto-written
   version would bury the actual plan and pin its ring at 0% forever.

   TWO ACTIONS, AND THEY ARE DIFFERENT VERBS:
     ✓  บันทึก  log the follow-up now. The row disappears on the next render
                because the record moved. For "I'll ring her while I'm here".
     +  แผน     promote it onto today's plan as a real task, linked to the
                record. For "not now, but today". Ticking THAT is what logs
                the activity — app/(app)/plan/actions.ts completeTask.

   Rows already promoted stay visible, marked, and sorted last. Hiding them
   would make the list read as shorter than the work actually is. */

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, Plus, User } from "lucide-react";
import { PlanCard, PlanCardTitle } from "./Bits";
import { promoteToPlan } from "@/app/(app)/plan/actions";
import type { FollowUpRow, FollowUps } from "@/lib/repo/today";
import type { Planner } from "./usePlanner";
import { formatNum } from "@/lib/format";

export function FollowUpCard({
  data,
  planner,
}: {
  data: FollowUps;
  planner: Planner;
}) {
  const total = data.totalLeads + data.totalListings;
  // Optimistically hidden ids. The row should leave under the finger, not a
  // round trip later. Only LOGGING hides a row — and logging is the one action
  // here that cannot be undone, so this set never has to give anything back.
  /* `gone` existed to hide a row the instant the ✓ logged it. With the ✓
     removed, a row leaves when the server says so: logActivity revalidates
     the dashboard, so writing on the record clears it here on the way back. */
  const [error, setError] = useState<string | null>(null);

  const rows = data.rows;

  if (!total) {
    return (
      <PlanCard>
        <PlanCardTitle>ติดตามวันนี้</PlanCardTitle>
        <p className="text-[0.82rem] text-ink-3">
          ตามครบทุกรายแล้ว — ไม่มีลูกค้าหรือทรัพย์ที่เลยกำหนดติดตาม
        </p>
      </PlanCard>
    );
  }

  return (
    <PlanCard>
      <PlanCardTitle
        action={
          <span
            title={`ลูกค้า ${data.totalLeads} · ทรัพย์ ${data.totalListings}`}
            className="num shrink-0 rounded-full bg-bad-soft px-2.5 py-0.5 text-[0.75rem] font-bold text-bad"
          >
            {formatNum(total)}
          </span>
        }
      >
        ติดตามวันนี้
      </PlanCardTitle>

      <p className="-mt-2 mb-3 text-[0.72rem] text-ink-3">
        เลยกำหนดตาม SLA · ลูกค้า <span className="num">{data.totalLeads}</span> ·
        ทรัพย์ <span className="num">{data.totalListings}</span>
      </p>

      {error && (
        <p
          role="alert"
          className="mb-2.5 flex items-start gap-1.5 rounded-xl bg-bad-soft px-3 py-2 text-[0.75rem] text-bad"
        >
          <AlertTriangle size={13} className="mt-px shrink-0" /> {error}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-line">
        {rows.map((r) => (
          <Row
            key={keyOf(r)}
            row={r}
            /* DERIVED from the planner's own tasks, not from a local Set.
               That is what makes อยู่ในแผน survive an undo: ↩ on a promotion
               deletes the task, this recomputes, and the + comes back. A
               separate Set would have stayed stuck on "claimed" with no task
               behind it. `r.onPlan` covers rows claimed in an earlier session
               that the planner has not loaded a task for. */
            claimed={
              r.onPlan ||
              planner.allTasks.some((t) => !t.done && pointsAt(t.leadId, t.listingId, r))
            }
            onError={setError}
            planner={planner}
          />
        ))}
      </ul>

      {/* The cap is stated, never silent — "7 จาก 151" is a different message
          from "7". Both links land on the browsers, which already sort overdue
          rows to the top and badge them. */}
      {total > rows.length && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem]">
          <span className="text-ink-3">
            แสดง <span className="num">{rows.length}</span> จาก{" "}
            <span className="num">{formatNum(total)}</span> รายการ
          </span>
          <Link href="/leads" className="font-semibold text-accent-text hover:underline">
            ดูลูกค้าทั้งหมด
          </Link>
          <Link href="/listings" className="font-semibold text-accent-text hover:underline">
            ดูทรัพย์ทั้งหมด
          </Link>
        </div>
      )}
    </PlanCard>
  );
}

/** Keyed by side+id: a lead uuid and a listing uuid can never collide today,
    but the union makes that an accident rather than a rule. */
function keyOf(r: FollowUpRow): string {
  return `${r.side}:${r.id}`;
}

/** Does a plan task point at this row's record? */
function pointsAt(
  leadId: string | null,
  listingId: string | null,
  r: FollowUpRow
): boolean {
  return r.side === "lead" ? leadId === r.id : listingId === r.id;
}

function Row({
  row,
  claimed,
  onError,
  planner,
}: {
  row: FollowUpRow;
  claimed: boolean;
  onError: (m: string | null) => void;
  planner: Planner;
}) {
  const [pending, start] = useTransition();

  const promote = () =>
    start(async () => {
      onError(null);
      try {
        // The record's own name, not the task title, so the undo button reads
        // `เพิ่ม "ขิม" ลงแผน` rather than repeating the "ติดตาม " prefix.
        planner.adoptTask(await promoteToPlan(row.side, row.id), row.name);
      } catch {
        onError("เพิ่มลงแผนไม่สำเร็จ — ลองอีกครั้ง");
      }
    });

  return (
    <li className={`flex items-center gap-2 py-2 ${pending ? "opacity-50" : ""}`}>
      {row.grade && (
        <span
          title={`เกรด ${row.grade}`}
          className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[0.62rem] font-bold text-ink-2"
        >
          {row.grade.slice(0, 1)}
        </span>
      )}

      {/* WHICH SIDE, stated rather than inferred. A person is obviously a
          person and a building obviously a building only while the data is
          tidy — an owner filed under a nickname, or a lead named after the
          project they want, breaks it, and the two sides mean different work.
          The grade chip cannot carry it: both sides grade A–D. */}
      {row.side === "lead" ? (
        <User size={12} className="shrink-0 text-ink-3" aria-label="ลูกค้า" />
      ) : (
        <Building2 size={12} className="shrink-0 text-ink-3" aria-label="ทรัพย์" />
      )}

      {/* Two lines, and a link. Line 1 is WHO to call — the owner's own name
          on a listing, not the building's. Line 2 is WHAT it is about, because
          the name alone does not say which unit. */}
      <Link
        href={row.side === "lead" ? `/leads/${row.id}` : `/listings/${row.id}`}
        title={`เปิด ${row.name}${row.subtitle ? ` · ${row.subtitle}` : ""}`}
        className="min-w-0 flex-1 leading-tight"
      >
        <span className="block truncate text-[0.82rem] text-ink hover:text-accent-text hover:underline">
          {row.name}
        </span>
        {row.subtitle && (
          <span className="block truncate text-[0.68rem] text-ink-3">
            {row.side === "lead" ? `สนใจ ${row.subtitle}` : row.subtitle}
          </span>
        )}
      </Link>

      {/* Days OVER the window, not days since contact. "เกิน 9 วัน" is
          actionable against the grade's own promise; "ติดต่อล่าสุด 12 วันก่อน"
          means nothing until you also remember the window. */}
      <span
        className="num shrink-0 text-[0.72rem] font-semibold text-bad"
        title={`ติดต่อล่าสุด ${row.days} วันก่อน · รอบติดตาม ${row.window} วัน`}
      >
        เกิน {row.daysOver} วัน
      </span>

      {claimed ? (
        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-semibold text-accent-text">
          อยู่ในแผน
        </span>
      ) : (
        <button
          onClick={promote}
          disabled={pending}
          aria-label={`เพิ่ม ${row.name} ลงแผนวันนี้`}
          title="เพิ่มลงแผนวันนี้ — ติ๊กในแผนแล้วจะบันทึกการติดตามให้เอง"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-accent-text transition-colors hover:bg-accent-soft disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      )}

      {/* THE ✓ IS GONE (Ben, 2026-08-30). It called logFollowUp, which wrote a
          bare "Follow" row with the record's name and no detail — the clock
          moved, the queue emptied, and the history said nothing about what was
          actually done. That is the same empty follow the two stamp buttons
          made, one click further away. Clearing a row now means opening it and
          writing what happened; the name beside this is the link. */}
    </li>
  );
}
