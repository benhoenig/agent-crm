"use client";

/* The plan column: the day, what is overdue, then the backlog — the same
   stack Solo Gang and Klaichan use, rather than any of it hiding behind a tab.

   THIS WRAPPER EXISTS FOR ONE REASON: every card must share ONE usePlanner.
   Two calls would be two independent optimistic states, so scheduling a
   backlog item into today would move it in one card and leave a ghost in the
   other until a reload. The state is lifted here; the cards are layout.

   ติดตามวันนี้ is inside that shared state rather than in the `afterDay`
   slot, and it has to be: promoting an overdue record must land in the day
   card above it without a refetch, which means it needs the same planner.

   THE DAY'S ACTIVITY LIST IS LIFTED HERE FOR THE SAME REASON (0019). Ticking
   a task that names an action category writes an `actions` row from inside
   usePlanner, and กิจกรรมวันนี้ has to show it at once — if that card owned
   its own list the row would be invisible until a reload, and the point of
   putting the two adjacent is that you SEE the plan feed the log. So the list
   lives here, the planner reports additions through onActivityLogged, and the
   card's own quick-log reports them through onLogged. */

import { useCallback, useState, type ReactNode } from "react";
import type { DayActivity, PlanData, TaskType } from "@/lib/plan";
import type { FollowUps } from "@/lib/repo/today";
import { DailyPlanCard } from "./DailyPlanCard";
import { BacklogCard } from "./BacklogCard";
import { FollowUpCard } from "./FollowUpCard";
import { ActivityLogCard } from "./ActivityLogCard";
import { QuantityPrompt } from "./QuantityPrompt";
import { HistoryBar } from "./HistoryBar";
import { usePlanner } from "./usePlanner";
import { useUndoShortcuts } from "./useHistory";

export function PlanColumn({
  initial,
  taskTypes,
  followUps,
  activities,
  actionCategories = [],
  afterDay,
}: {
  initial: PlanData;
  taskTypes: TaskType[];
  /** ติดตามวันนี้ rows, already scoped to the viewer. Null when the viewer
      can see neither leads nor listings — the card is then absent rather
      than empty. */
  followUps?: FollowUps | null;
  /** Slot between ติดตามวันนี้ and the backlog — โพสต์เก่า, in practice.
      Typed as ReactNode so a SERVER component can be passed in from a server
      page and rendered inside this client component untouched. */
  afterDay?: ReactNode;
  /** Today's `actions` rows. Undefined = this surface does not log activity,
      and neither the card nor the task picker appears. */
  activities?: DayActivity[];
  /** action_category keys, in picklist order. */
  actionCategories?: string[];
}) {
  const [logged, setLogged] = useState<DayActivity[]>(activities ?? []);
  // Newest last, matching getTodayActions' created-at order, so a row added
  // this session sits where a reload would put it.
  const addActivity = useCallback(
    (a: DayActivity) => setLogged((rows) => [...rows, a]),
    []
  );

  const planner = usePlanner(initial, activities ? addActivity : undefined);
  // Pulled out so the callback below depends on the stable handler rather
  // than on `planner`, which is a fresh object literal every render.
  const { untickTask } = planner;

  /* Removing an activity runs the link in reverse (0022). deleteActivity has
     already un-ticked the task server-side, so this only catches the checkbox
     up — hence untickTask, which writes nothing. Without it the task would
     sit ticked over an activity that no longer exists until a reload, which
     is the same disagreement the tick path works so hard to avoid. */
  const removeActivity = useCallback(
    (id: string, taskId: string | null) => {
      setLogged((rows) => rows.filter((r) => r.id !== id));
      if (taskId) untickTask(taskId);
    },
    [untickTask]
  );

  // ⌘Z / ⌘⇧Z. Bound at the document because the three cards are siblings with
  // no shared focusable wrapper, and skipped while a field has focus so it
  // never steals undo from a half-typed title.
  useUndoShortcuts(planner.history);

  return (
    <>
      {/* Above everything, driven purely by planner state: a tick can come
          from the day card, the backlog or ติดตามวันนี้, and the question has
          to look the same from all three. */}
      <QuantityPrompt planner={planner} />
      <HistoryBar history={planner.history} />
      <DailyPlanCard
        planner={planner}
        taskTypes={taskTypes}
        actionCategories={actionCategories}
      />
      {/* Directly under the day, before the queues: ticking a task above adds
          a row here, and separating the two by ติดตามวันนี้ would hide the
          feedback that makes the link worth having. */}
      {activities && (
        <ActivityLogCard activities={logged} onRemoved={removeActivity} />
      )}
      {/* Between the day and the backlog on purpose (Ben, 2026-08-25): work
          that is already past its SLA outranks the undated pile, but the day
          you actually planned still comes first. */}
      {followUps && <FollowUpCard data={followUps} planner={planner} />}
      {afterDay}
      <BacklogCard
        planner={planner}
        taskTypes={taskTypes}
        actionCategories={actionCategories}
      />
    </>
  );
}
