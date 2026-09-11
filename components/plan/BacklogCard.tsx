"use client";

/* รายการรอ — undated capture, as its own card under the day.

   It was a tab inside the plan card until Ben moved it out (2026-08-07): a
   backlog you have to remember to open is a backlog you stop writing to. Out
   here the count is visible without a tap, which is the whole point of
   keeping one.

   The card is a frame around BacklogPanel — the list itself, the add field
   and the schedule affordance all still live there, shared with nothing. */

import { PlanCard, PlanCardTitle } from "./Bits";
import type { TaskType } from "@/lib/plan";
import { BacklogPanel } from "./Panels";
import type { Planner } from "./usePlanner";

export function BacklogCard({
  planner,
  taskTypes,
  actionCategories = [],
}: {
  planner: Planner;
  taskTypes: TaskType[];
  actionCategories?: string[];
}) {
  const count = planner.backlogTasks.length;

  return (
    <PlanCard>
      <PlanCardTitle
        action={
          count > 0 ? (
            <span
              title={`${count} งานรอจัดเวลา`}
              className="num shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[0.75rem] font-bold text-accent-text"
            >
              {count}
            </span>
          ) : undefined
        }
      >
        รายการรอ
      </PlanCardTitle>

      <p className="-mt-2 mb-3 text-[0.72rem] text-ink-3">
        งานที่ยังไม่ลงวัน — แตะที่งานเพื่อเลือกวันและเวลา แล้วจัดลงแผน
      </p>

      <BacklogPanel planner={planner} taskTypes={taskTypes} actionCategories={actionCategories} />
    </PlanCard>
  );
}
