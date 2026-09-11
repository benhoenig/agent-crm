"use client";

/* The planner's shared state and handlers.

   PORTED FROM Solo Gang's `src/hooks/usePlanner.js`. Two structural changes,
   both forced by this app being Next.js rather than a client SPA:

     1. The initial data arrives as a PROP from the server component, not from
        a fetch on mount. So there is no loading state and no skeleton — the
        card is correct on first paint.
     2. Writes are server ACTIONS, not /api routes. Same optimism: local state
        moves first, the action is fire-and-forget, and nothing revalidates
        the page (see lib/plan/actions.ts for why).

   Everything else — lazy materialization, the auto day-off, the carry-forward
   from yesterday's recap — is the original behaviour. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bkkToday } from "@/lib/format";
import {
  addDays, compareDayTasks, isLinked, pendingRules, planDateLabel,
  recordsActivity, weekdayOf,
  streakOf, bestStreakOf, dayDoneCelebration,
  type Celebration, type DayActivity, type PlanData, type PlanTask, type RecurRule, type DayRecap,
} from "@/lib/plan";
import * as api from "@/app/(app)/plan/actions";
import { completeTask } from "@/app/(app)/plan/actions";
import { useHistory, type History, type TaggedEntry } from "./useHistory";

export interface Planner {
  today: string;
  planDate: string;
  setPlanDate: (d: string) => void;

  allTasks: PlanTask[];
  dayTasks: PlanTask[];
  backlogTasks: PlanTask[];
  recurring: RecurRule[];
  dayoffs: Set<string>;

  donePct: number;
  doneCount: number;
  isDayOff: boolean;
  /** Does the weekly rule cover the day being viewed? */
  isRuleOff: boolean;
  offDays: number[];


  dayRecap: DayRecap;
  /** Yesterday's "one thing I'll try tomorrow", if there was one. */
  carryTomorrow: string;

  celebration: Celebration | null;
  clearCelebration: () => void;

  /* ---- confirming a count before it is logged (0026) -------------------

     A task that carries a targetQuantity does not tick straight through.
     `updateTask` parks it here instead, the surface renders a prompt, and
     `confirmQuantity` finishes the tick with the number the user actually
     confirmed — which is why the plan's target and the activity's quantity
     are two columns and not one.

     ONLY TASKS WITH A TARGET ARE PARKED. Everything else — a plain to-do, a
     promoted follow-up, a categorised task nobody put a number on — ticks
     exactly as it did before, because adding a dialog to a checkbox that
     never needed one is how a good flow gets worse. */
  quantityPrompt: { taskId: string; title: string; target: number } | null;
  /** Finish the parked tick. `null` logs no count at all. */
  confirmQuantity: (n: number | null) => void;
  /** Walk away — the task stays unticked and nothing is written. */
  cancelQuantity: () => void;

  /** The one thing in this planner that can visibly fail. Ticking a task
      linked to a lead or listing writes a CRM activity first, and if that
      write is refused the tick is rolled back — silently reverting a checkbox
      would look like a bug, so the reason is surfaced instead. Null the rest
      of the time. */
  taskError: string | null;
  clearTaskError: () => void;

  /** Splice a task created elsewhere (ติดตามวันนี้ promoting a record) into
      the planner's state, so the day updates without a refetch. Pass the
      record's name for a readable undo label. */
  adoptTask: (task: PlanTask, recordName?: string) => void;

  /** Clear a task's tick in LOCAL STATE ONLY — no write, no history entry.
      Called by กิจกรรมวันนี้ after removing the activity that task wrote:
      the server already un-ticked it inside the same statement pair, so a
      second write here would be a lie about who owns the change, and an undo
      entry would offer to re-tick a task with nothing behind it. */
  untickTask: (id: string) => void;

  /** Undo/redo across all three cards in the plan column. See useHistory for
      what is deliberately excluded. */
  history: History;

  addTask: (title: string, opts?: Partial<Pick<PlanTask, "kind" | "notes" | "startTime" | "endTime" | "actionCategory" | "targetQuantity">>) => void;
  addToBacklog: (title: string, opts?: Partial<Pick<PlanTask, "kind" | "notes" | "actionCategory" | "targetQuantity">>) => void;
  updateTask: (id: string, patch: Partial<PlanTask>) => void;
  removeTask: (id: string) => void;
  reorder: (orderedIds: string[]) => void;
  /** Move a backlog item into the day currently being planned. */
  scheduleToPlan: (id: string) => void;
  /** Move a backlog item into a specific day, with optional times. */
  scheduleAt: (id: string, patch: Partial<PlanTask> & { date: string }) => void;
  /** Move many tasks onto one day as one undoable step (/plan's bulk
      reschedule). Each remembers where it came from. */
  rescheduleMany: (ids: string[], date: string) => void;

  createRule: (spec: api.RuleInput) => void;
  stopRule: (id: string) => void;
  deleteRule: (id: string) => void;

  toggleDayOff: () => void;
  toggleWeeklyOffDay: (weekday: number) => void;

  updateRecap: (patch: Partial<Pick<DayRecap, "good" | "lesson" | "tomorrow">>) => void;
}

const EMPTY_RECAP = (date: string): DayRecap => ({ date, good: "", lesson: "", tomorrow: "" });

export function usePlanner(
  initial: PlanData,
  /** Called with the `actions` row when ticking a task logs one, so the
      กิจกรรมวันนี้ card below can show it immediately. The planner does not
      own that list — it only knows when it grew. */
  onActivityLogged?: (a: DayActivity) => void
): Planner {
  const today = bkkToday();

  const [allTasks, setAllTasks] = useState<PlanTask[]>(initial.tasks);
  const [recurring, setRecurring] = useState<RecurRule[]>(initial.recurring);
  const [dayoffList, setDayoffList] = useState<string[]>(initial.dayoffs);
  const [recaps, setRecaps] = useState<DayRecap[]>(initial.recaps);
  const [offDays, setOffDays] = useState<number[]>(initial.prefs.offDays);
  const [offDaysSkip, setOffDaysSkip] = useState<string[]>(initial.prefs.offDaysSkip);
  const [planDate, setPlanDate] = useState(today);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [quantityPrompt, setQuantityPrompt] = useState<
    { taskId: string; title: string; target: number } | null
  >(null);

  const dayoffs = useMemo(() => new Set(dayoffList), [dayoffList]);

  /* ---- lazy materialization of recurring rules ----
     Whenever a day ≥ today is shown, ask the server to turn any due rules
     into real rows. Once per day per session (`materialized`), and skipped
     entirely when nothing is due — so walking through a week of dates costs
     at most one round trip per day that actually owes tasks. */
  const materialized = useRef(new Set<string>());
  useEffect(() => {
    if (planDate < today || materialized.current.has(planDate)) return;
    materialized.current.add(planDate);
    const dayTasks = allTasks.filter((t) => t.date === planDate);
    if (!pendingRules(recurring.filter((r) => r.active), dayTasks, planDate).length) return;

    api.materializeRecurring(planDate).then((created) => {
      if (!created.length) return;
      setAllTasks((ts) => {
        const ids = new Set(ts.map((t) => t.id));
        // Guard on the rule+day pair as well as the id: an optimistic row and
        // a server row for the same rule are different ids but one task.
        const add = created.filter((c) => !ids.has(c.id)
          && !ts.some((t) => t.recurringId && t.recurringId === c.recurringId && t.date === c.date));
        return add.length ? [...ts, ...add] : ts;
      });
    }).catch(() => { /* a missed materialize retries next session; never blocks the card */ });
  }, [planDate, today, allTasks, recurring]);

  const dayTasks = useMemo(
    () => allTasks.filter((t) => t.date === planDate).sort(compareDayTasks),
    [allTasks, planDate],
  );
  const backlogTasks = useMemo(
    () => allTasks.filter((t) => !t.date).sort((a, b) => a.sortOrder - b.sortOrder),
    [allTasks],
  );

  const isDayOff = dayoffs.has(planDate);
  const isRuleOff = offDays.includes(weekdayOf(planDate));

  /* ---- the weekly day-off rule, materialized the same lazy way ----
     A day the rule covers auto-marks the first time it is opened, from today
     forward. Same shape as recurring tasks: no background job, so past days
     are never rewritten and the streak rules stay untouched. */
  const autoOff = useRef(new Set<string>());
  useEffect(() => {
    if (planDate < today || autoOff.current.has(planDate)) return;
    if (!isRuleOff || offDaysSkip.includes(planDate) || dayoffs.has(planDate)) return;
    autoOff.current.add(planDate);
    setDayoffList((ds) => (ds.includes(planDate) ? ds : [...ds, planDate]));
    api.setDayOff(planDate, true).catch(() => {});
  }, [planDate, today, isRuleOff, offDaysSkip, dayoffs]);

  /* ---- undo / redo ----------------------------------------------------

     Scope: the three cards in this column — the day, ติดตามวันนี้ and the
     backlog. Item-level work only.

     THE PRIMITIVES BELOW ARE THE UNIT OF UNDO. Each applies local state and
     the matching server write and nothing else, so a mutation and its inverse
     are the same code run with different arguments. The public handlers are
     thin wrappers that capture the before-state, call a primitive, and push
     the pair onto the stack.

     THREE THINGS DELIBERATELY NEVER REACH THE STACK, because a half-correct
     undo is worse than none:

       logFollowUp / a linked tick   both write an `activities` row and reset
                                     the record's last_follow. Append-only by
                                     design everywhere in this app; there is
                                     no honest inverse. `forget` additionally
                                     drops any earlier entry for a task whose
                                     follow-up has since been logged, so an
                                     un-promote can never strand an activity.
       recurring rules               creating one also materializes task
                                     instances, so the inverse has to unwind
                                     two things; it is rule-level config, not
                                     item-level work.
       สรุปวัน text                  a textarea already has the browser's own
                                     undo, and an app-level stack would fight
                                     ⌘Z inside the field. */

  const history = useHistory();

  const applyPatch = useCallback((id: string, patch: Partial<PlanTask>) => {
    setAllTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    api.updateTask(id, patch as api.TaskPatch).catch(() => {});
  }, []);

  const applyRemove = useCallback((id: string) => {
    setAllTasks((ts) => ts.filter((t) => t.id !== id));
    api.deleteTask(id).catch(() => {});
  }, []);

  /** Reinstates the ORIGINAL id (see api.restoreTask), which is what keeps
      other stack entries mentioning this task runnable after an undo. */
  const applyRestore = useCallback((task: PlanTask) => {
    setAllTasks((ts) => (ts.some((t) => t.id === task.id) ? ts : [...ts, task]));
    api.restoreTask(task).catch(() => {});
  }, []);

  const applyOrder = useCallback((orderedIds: string[]) => {
    const orderById = Object.fromEntries(orderedIds.map((id, i) => [id, i + 1]));
    setAllTasks((ts) => ts.map((t) => (orderById[t.id] != null ? { ...t, sortOrder: orderById[t.id] } : t)));
    api.reorderTasks(orderedIds).catch(() => {});
  }, []);

  /** Trim a task's title for a button label. Long titles would push the
      undo control off a phone; 18 characters is enough to recognise which
      task without wrapping the bar. */
  const short = (s: string) => (s.length > 18 ? `${s.slice(0, 18)}…` : s);

  /* ---- mutations ---- */

  /** Fire the celebration if this patch is what finishes the day.

      Read against the PRE-tick `dayTasks`, which is what makes "this tick
      completed the day" distinguishable from "this is one of several already
      done". Split out of updateTask so the linked path can defer it until the
      server write has actually succeeded. */
  const celebrateIfDayDone = useCallback((id: string, patch: Partial<PlanTask>) => {
    if (!(patch.done === true && dayTasks.length > 0 && !dayTasks.every((t) => t.done))) return;
    const after = dayTasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    if (!after.every((t) => t.done)) return;
    const updatedAll = allTasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    const prevBest = bestStreakOf(allTasks, dayoffs, today);
    setCelebration(dayDoneCelebration(streakOf(updatedAll, dayoffs, today), prevBest));
  }, [dayTasks, allTasks, dayoffs, today]);

  /** Write the activity, then tick — the order matters, see completeTask.
      Shared by the straight-through tick and the confirmed-count one, so
      there is exactly one place that can roll a failed tick back. */
  const runComplete = useCallback((id: string, quantity: number | null) => {
    setTaskError(null);
    setAllTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: true } : t)));
    completeTask(id, quantity)
      .then((logged) => {
        onActivityLogged?.(logged);
        // The activity is written and cannot be un-written, so any earlier
        // entry for this task — its promotion, an edit to its title — is
        // no longer safely reversible. Drop them rather than let an undo
        // delete a task whose follow-up is already on the record.
        history.forget((e) => (e as TaggedEntry).taskId === id);
        celebrateIfDayDone(id, { done: true });
      })
      .catch(() => {
        setAllTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: false } : t)));
        setTaskError("บันทึกกิจกรรมไม่สำเร็จ — ยังไม่ได้ทำเครื่องหมายว่าเสร็จ");
      });
  }, [history, celebrateIfDayDone, onActivityLogged]);

  /** Finish a tick that was parked for a count. */
  const confirmQuantity = useCallback((n: number | null) => {
    setQuantityPrompt((p) => {
      if (p) runComplete(p.taskId, n);
      return null;
    });
  }, [runComplete]);

  const updateTask = useCallback((id: string, patch: Partial<PlanTask>) => {
    const task = allTasks.find((t) => t.id === id);

    /* SOME CHECKBOXES ARE A CRM WRITE, NOT A LOCAL FLAG.

       Completing "ติดตาม คุณสมชาย" has to log the activity that resets the
       lead's follow-up clock and feeds the monthly scoreboard, and since 0019
       so does any task that NAMES an action category — that is how the plan
       became the activity log. So this path does not use the fire-and-forget
       updateTask: it calls completeTask, which writes the activity FIRST and
       only then marks the task done. If that fails the tick is rolled back,
       because a task that says "done" over a record still sitting overdue is
       the exact drift this link exists to prevent.

       Un-ticking is refused HERE rather than reverted, because the activity
       is the real record and the checkbox only reflects it — clearing the box
       would strand a logged activity and let the next tick write a second
       one. The undo lives where the record does: remove the row from
       กิจกรรมวันนี้ and the task un-ticks with it (0022). A follow-up is the
       one thing with no way back, since it also stamped a lead or listing. */
    if (task && recordsActivity(task)) {
      if (patch.done === false) {
        setTaskError(
          isLinked(task)
            ? "งานติดตามที่บันทึกแล้วย้อนกลับไม่ได้ — ประวัติการติดตามลบไม่ได้"
            : "ยกเลิกโดยลบรายการในการ์ด “กิจกรรมวันนี้” ด้านล่าง"
        );
        return;
      }
      if (patch.done === true) {
        /* A PLANNED COUNT IS A QUESTION, NOT AN ANSWER (0026). The task says
           you meant to do five; only you know whether five happened. So the
           tick parks here and the surface asks, rather than logging the
           target and quietly making the scoreboard wrong. Tasks with no
           target skip this entirely. */
        if (task.targetQuantity !== null) {
          setTaskError(null);
          setQuantityPrompt({
            taskId: id,
            title: task.title,
            target: task.targetQuantity,
          });
          return;
        }
        runComplete(id, null);
        return;
      }
      // Any other edit (title, notes, category) is an ordinary task edit and
      // falls through — only `done` carries the CRM meaning.
    }

    celebrateIfDayDone(id, patch);

    // The before-state, narrowed to exactly the keys this patch touches, so
    // undoing a title edit cannot also revert a category changed since.
    if (task) {
      const before: Partial<PlanTask> = {};
      for (const k of Object.keys(patch) as (keyof PlanTask)[]) {
        (before as Record<string, unknown>)[k] = task[k];
      }
      history.push({
        label: patch.done === true ? `ทำเสร็จ "${short(task.title)}"`
          : patch.done === false ? `ยกเลิกเสร็จ "${short(task.title)}"`
          : `แก้ไข "${short(task.title)}"`,
        taskId: id,
        undo: () => applyPatch(id, before),
        redo: () => applyPatch(id, patch),
      } as TaggedEntry);
    }

    applyPatch(id, patch);
  }, [allTasks, celebrateIfDayDone, history, applyPatch, runComplete]);

  /** Adopt a row the server already created — the ติดตามวันนี้ card promoting
      a record. Idempotent on id, because promoteToPlan hands back the
      existing task when one is already open for that record.

      UNDOABLE, because promoting has written nothing to the CRM yet: the task
      is a note to self, and deleting it leaves the lead or listing exactly as
      it was. That stops being true the moment the task is ticked, which is
      why completeTask calls history.forget on this same taskId. */
  const adoptTask = useCallback((task: PlanTask, recordName?: string) => {
    setAllTasks((ts) => (ts.some((t) => t.id === task.id) ? ts : [...ts, task]));
    history.push({
      label: `เพิ่ม "${short(recordName ?? task.title)}" ลงแผน`,
      taskId: task.id,
      undo: () => applyRemove(task.id),
      redo: () => applyRestore(task),
    } as TaggedEntry);
  }, [history, applyRemove, applyRestore]);

  // Local only — see the Planner interface for why this writes nothing.
  const untickTask = useCallback((id: string) => {
    setTaskError(null);
    setAllTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: false } : t)));
  }, []);

  const removeTask = useCallback((id: string) => {
    const snapshot = allTasks.find((t) => t.id === id);
    applyRemove(id);
    if (snapshot) {
      history.push({
        label: `ลบ "${short(snapshot.title)}"`,
        taskId: id,
        undo: () => applyRestore(snapshot),
        redo: () => applyRemove(id),
      } as TaggedEntry);
    }
  }, [allTasks, history, applyRemove, applyRestore]);

  /** Insert optimistically under a temporary id, then swap in the real row.
      The temp id is never sent anywhere — it only has to be unique on screen
      long enough for React to key the row. */
  const insert = useCallback((date: string | null, title: string, opts: Partial<PlanTask>, siblings: PlanTask[]) => {
    const tempId = `tmp-${Math.random().toString(36).slice(2, 9)}`;
    const row: PlanTask = {
      id: tempId, date, title, done: false,
      sortOrder: siblings.length + 1,
      kind: opts.kind ?? null, actionCategory: opts.actionCategory ?? null,
      targetQuantity: opts.targetQuantity ?? null,
      notes: opts.notes ?? null, recurringId: null,
      // Typed by hand, so it points at no record. Promotion out of
      // ติดตามวันนี้ goes through its own action, not this path.
      leadId: null, listingId: null,
      startTime: opts.startTime ?? null, endTime: opts.endTime ?? null,
    };
    setAllTasks((ts) => [...ts, row]);
    api.createTask({
      title, date, kind: row.kind, actionCategory: row.actionCategory,
      targetQuantity: row.targetQuantity,
      notes: row.notes, startTime: row.startTime, endTime: row.endTime,
    })
      .then((created) => {
        setAllTasks((ts) => ts.map((t) => (t.id === tempId ? created : t)));
        // Pushed HERE, not before the call: until the server answers there is
        // no real id, and an undo entry pointing at `tmp-x9k2` would delete
        // nothing. A creation that fails pushes nothing, which is right —
        // there is no longer anything to undo.
        history.push({
          label: `เพิ่ม "${short(created.title)}"`,
          taskId: created.id,
          undo: () => applyRemove(created.id),
          redo: () => applyRestore(created),
        } as TaggedEntry);
      })
      // The row is dropped rather than left behind: a task that looks saved
      // but isn't is worse than one that visibly failed to appear.
      .catch(() => setAllTasks((ts) => ts.filter((t) => t.id !== tempId)));
  }, [history, applyRemove, applyRestore]);

  const addTask: Planner["addTask"] = useCallback((title, opts = {}) => {
    insert(planDate, title, opts, dayTasks);
  }, [insert, planDate, dayTasks]);

  const addToBacklog: Planner["addToBacklog"] = useCallback((title, opts = {}) => {
    insert(null, title, opts, backlogTasks);
  }, [insert, backlogTasks]);

  const reorder = useCallback((orderedIds: string[]) => {
    // The previous order of exactly these ids, read off their current
    // sortOrder — not the whole day, so an undo cannot disturb a row that was
    // not part of the drag.
    const before = orderedIds
      .map((id) => allTasks.find((t) => t.id === id))
      .filter((t): t is PlanTask => !!t)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => t.id);

    applyOrder(orderedIds);
    history.push({
      label: "จัดลำดับงาน",
      undo: () => applyOrder(before),
      redo: () => applyOrder(orderedIds),
    });
  }, [allTasks, history, applyOrder]);

  const scheduleToPlan = useCallback((id: string) => {
    const task = allTasks.find((t) => t.id === id);
    const patch = { date: planDate, sortOrder: dayTasks.length + 1 };
    applyPatch(id, patch);
    if (task) {
      history.push({
        label: `จัดลงแผน "${short(task.title)}"`,
        taskId: id,
        // Back to the backlog (date null) or to whichever day it came from.
        undo: () => applyPatch(id, { date: task.date, sortOrder: task.sortOrder }),
        redo: () => applyPatch(id, patch),
      } as TaggedEntry);
    }
  }, [allTasks, dayTasks.length, planDate, history, applyPatch]);

  const scheduleAt = useCallback((id: string, patch: Partial<PlanTask> & { date: string }) => {
    const task = allTasks.find((t) => t.id === id);
    const full = { ...patch, sortOrder: allTasks.filter((t) => t.date === patch.date).length + 1 };
    applyPatch(id, full);
    if (task) {
      const before: Partial<PlanTask> = {};
      for (const k of Object.keys(full) as (keyof PlanTask)[]) {
        (before as Record<string, unknown>)[k] = task[k];
      }
      history.push({
        label: `จัดลงแผน "${short(task.title)}"`,
        taskId: id,
        undo: () => applyPatch(id, before),
        redo: () => applyPatch(id, full),
      } as TaggedEntry);
    }
  }, [allTasks, history, applyPatch]);

  /** Move a set of tasks onto one day, as a SINGLE undo entry.

      The bulk action behind "เลื่อนงานที่เกินกำหนดมาวันนี้" on /plan. Pushing
      one entry per task would mean tapping ↩ eleven times to reverse one
      button press — the stack should mirror what the user did, not what the
      code did. Each task remembers its own previous date and order, so the
      inverse scatters them back where they came from rather than dumping them
      all on one day. */
  const rescheduleMany = useCallback((ids: string[], date: string) => {
    const moving = ids
      .map((id) => allTasks.find((t) => t.id === id))
      .filter((t): t is PlanTask => !!t && t.date !== date);
    if (!moving.length) return;

    const base = allTasks.filter((t) => t.date === date).length;
    const after = moving.map((t, i) => ({ id: t.id, date, sortOrder: base + i + 1 }));
    const before = moving.map((t) => ({ id: t.id, date: t.date, sortOrder: t.sortOrder }));

    const apply = (rows: { id: string; date: string | null; sortOrder: number }[]) => {
      const by = new Map(rows.map((r) => [r.id, r]));
      setAllTasks((ts) => ts.map((t) => {
        const r = by.get(t.id);
        return r ? { ...t, date: r.date, sortOrder: r.sortOrder } : t;
      }));
      for (const r of rows) {
        api.updateTask(r.id, { date: r.date, sortOrder: r.sortOrder }).catch(() => {});
      }
    };

    apply(after);
    history.push({
      label: `เลื่อน ${moving.length} งาน`,
      undo: () => apply(before),
      redo: () => apply(after),
    });
  }, [allTasks, history]);

  const createRule = useCallback((spec: api.RuleInput) => {
    api.createRecurring(spec).then((rule) => {
      setRecurring((rs) => [...rs, rule]);
      // Show the first instance now if the viewed day is due. This is the ONLY
      // materialize for the new rule — the day is already in `materialized`,
      // so the effect stays suppressed and cannot fire a racing second call.
      return api.materializeRecurring(planDate);
    }).then((created) => {
      if (created?.length) setAllTasks((ts) => [...ts, ...created]);
    }).catch(() => {});
  }, [planDate]);

  /** Stop a series. Future days only — instances already on a plan stay,
      because cancelling a repeat does not un-happen the days it made. */
  const stopRule = useCallback((id: string) => {
    setRecurring((rs) => rs.map((r) => (r.id === id ? { ...r, active: false } : r)));
    api.updateRecurring(id, { active: false }).catch(() => {});
  }, []);

  const deleteRule = useCallback((id: string) => {
    setRecurring((rs) => rs.filter((r) => r.id !== id));
    api.deleteRecurring(id).catch(() => {});
  }, []);

  /* ---- day offs ---- */

  const persistSkip = useCallback((next: string[]) => {
    // Forward-only, so past dates are dead weight — pruned on every write to
    // keep the stored list bounded.
    const pruned = next.filter((d) => d >= today);
    setOffDaysSkip(pruned);
    api.savePlanPrefs({ offDaysSkip: pruned }).catch(() => {});
  }, [today]);

  /** Set a specific DATE's day-off flag, rather than "the day being viewed".

      Taking the date as an argument is what makes this undoable: the stack
      entry captures the day it was toggled on, so hitting ↩ after paging to
      next week reverses the right day instead of whichever one happens to be
      on screen. */
  const setDayOffOn = useCallback((date: string, off: boolean) => {
    const ruleCovers = offDays.includes(weekdayOf(date));
    if (off) {
      setDayoffList((ds) => (ds.includes(date) ? ds : [...ds, date]));
      api.setDayOff(date, true).catch(() => {});
      if (ruleCovers && offDaysSkip.includes(date)) {
        persistSkip(offDaysSkip.filter((d) => d !== date));
      }
    } else {
      setDayoffList((ds) => ds.filter((d) => d !== date));
      api.setDayOff(date, false).catch(() => {});
      // Clearing a day the weekly rule covers means "I'm working THIS one".
      // Record the opt-out, or the auto-mark restores it on the next visit.
      if (ruleCovers && date >= today && !offDaysSkip.includes(date)) {
        persistSkip([...offDaysSkip, date]);
      }
    }
  }, [offDays, today, offDaysSkip, persistSkip]);

  const toggleDayOff = useCallback(() => {
    const date = planDate;
    const wasOff = dayoffs.has(date);
    setDayOffOn(date, !wasOff);
    history.push({
      // The Thai label, not the ISO string — the entry may be undone from a
      // different day than the one it was made on, so it has to read.
      label: wasOff ? `ยกเลิกวันหยุด ${planDateLabel(date)}` : `ตั้งวันหยุด ${planDateLabel(date)}`,
      undo: () => setDayOffOn(date, wasOff),
      redo: () => setDayOffOn(date, !wasOff),
    });
  }, [dayoffs, planDate, setDayOffOn, history]);

  const setWeeklyOffDays = useCallback((next: number[]) => {
    setOffDays(next);
    api.savePlanPrefs({ offDays: next }).catch(() => {});
    // The viewed day auto-marks immediately as `isRuleOff` flips; other future
    // days mark when opened. Removing a weekday leaves days already marked
    // alone — the same "stopping a rule doesn't unwind its past" rule as
    // recurring tasks.
    autoOff.current.delete(planDate);
  }, [planDate]);

  const toggleWeeklyOffDay = useCallback((wd: number) => {
    const before = offDays;
    const next = offDays.includes(wd) ? offDays.filter((d) => d !== wd) : [...offDays, wd].sort((a, b) => a - b);
    setWeeklyOffDays(next);
    history.push({
      label: "วันหยุดประจำสัปดาห์",
      undo: () => setWeeklyOffDays(before),
      redo: () => setWeeklyOffDays(next),
    });
  }, [offDays, setWeeklyOffDays, history]);

  /* ---- recap ---- */

  const dayRecap = useMemo(
    () => recaps.find((r) => r.date === planDate) ?? EMPTY_RECAP(planDate),
    [recaps, planDate],
  );

  // Debounced so typing a reflection isn't one write per keystroke.
  const recapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateRecap = useCallback((patch: Partial<Pick<DayRecap, "good" | "lesson" | "tomorrow">>) => {
    const next = { ...dayRecap, ...patch, date: planDate };
    setRecaps((rs) => (rs.some((r) => r.date === planDate)
      ? rs.map((r) => (r.date === planDate ? next : r))
      : [...rs, next]));
    if (recapTimer.current) clearTimeout(recapTimer.current);
    recapTimer.current = setTimeout(() => {
      api.saveRecap(planDate, { good: next.good, lesson: next.lesson, tomorrow: next.tomorrow }).catch(() => {});
    }, 600);
  }, [dayRecap, planDate]);

  // Flush a pending recap on unmount, so navigating away mid-sentence doesn't
  // lose the last 600ms of typing.
  useEffect(() => () => { if (recapTimer.current) clearTimeout(recapTimer.current); }, []);

  const carryTomorrow = useMemo(
    () => recaps.find((r) => r.date === addDays(planDate, -1))?.tomorrow?.trim() ?? "",
    [recaps, planDate],
  );

  const doneCount = dayTasks.filter((t) => t.done).length;

  return {
    today, planDate, setPlanDate,
    allTasks, dayTasks, backlogTasks, recurring, dayoffs,
    donePct: dayTasks.length ? Math.round((doneCount / dayTasks.length) * 100) : 0,
    doneCount,
    isDayOff, isRuleOff, offDays,
    // No `streak` / `bestStreak` here on purpose. The tiles that showed them
    // were removed (Ben, 2026-08-07) and both walked every task on every
    // render. The streak RULES stay — the celebration still computes a run
    // when a day is completed — but nothing displays a running total now.
    dayRecap, carryTomorrow,
    celebration, clearCelebration: () => setCelebration(null),
    taskError, clearTaskError: () => setTaskError(null),
    quantityPrompt,
    confirmQuantity,
    cancelQuantity: () => setQuantityPrompt(null),
    adoptTask, untickTask, history,
    addTask, addToBacklog, updateTask, removeTask, reorder, scheduleToPlan, scheduleAt, rescheduleMany,
    createRule, stopRule, deleteRule,
    toggleDayOff, toggleWeeklyOffDay,
    updateRecap,
  };
}
