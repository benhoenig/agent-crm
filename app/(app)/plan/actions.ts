"use server";

/* Planner mutations — ported from the Klaichan/Mook CRM planner.

   NO PERMISSION GATE, BY DESIGN — a deliberate exception in a codebase where
   every other action checks the matrix. A plan is the signed-in person's own
   to-do list: there is nothing to authorise beyond being signed in, and every
   statement below is scoped by `userId` taken from the SESSION, never from
   the request body. An id passed by a caller is only ever used inside a
   `where` that also pins the user, so the worst a forged id can do is update
   zero rows.

   No revalidatePath either. The card is optimistic — a tick has to land
   instantly on a phone — so it patches its own state and these calls are
   fire-and-forget. The ONE exception is completeTask, whose whole point
   is that the CRM write happens first and the tick only follows. */

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  actions,
  contacts,
  dailyPlanTasks,
  leads,
  listings,
  planDayoffs,
  planPrefs,
  planRecaps,
  planRecurring,
} from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { bkkToday } from "@/lib/format";
import { toTask, toRule } from "@/lib/repo/plan";
import {
  normalizeFreq,
  pendingRules,
  type DayActivity,
  type PlanTask,
  type RecurRule,
} from "@/lib/plan";

async function me(): Promise<string> {
  return (await getViewer()).userId;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** A countable quantity, or null. Rejects negatives and NaN rather than
    storing them, and rounds — "2.5 calls" is a typo, not a measurement.
    Zero SURVIVES: "I planned five and did none" is a real thing to record,
    and is not the same as "no number applies" (null). */
function count(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v) || v < 0) return null;
  return Math.round(v);
}

/** Normalise the free-form bits of a task payload. Empty string → NULL
    throughout, so "no note" and "a blank note" cannot become two states. */
function clean(input: TaskInput) {
  const time = (v: string | null | undefined) => (v && HHMM.test(v) ? v : null);
  return {
    title: (input.title ?? "").trim(),
    date: input.date && ISO.test(input.date) ? input.date : null,
    kind: input.kind?.trim() || null,
    actionCategory: input.actionCategory?.trim() || null,
    targetQuantity: count(input.targetQuantity),
    notes: input.notes?.trim() || null,
    startTime: time(input.startTime),
    endTime: time(input.endTime),
  };
}

export interface TaskInput {
  title: string;
  /** null / omitted = backlog. */
  date?: string | null;
  kind?: string | null;
  /** options "action_category" — ticking this task then logs the activity. */
  actionCategory?: string | null;
  /** How many you mean to do (0026). Only meaningful alongside a category:
      the count is logged onto the activity the tick writes. */
  targetQuantity?: number | null;
  notes?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

/* ---------- tasks --------------------------------------------------------- */

/** Next order value at the end of a day (or the backlog), computed in SQL so
    two tabs adding at once can't both claim the same slot. */
async function nextOrder(userId: string, date: string | null): Promise<number> {
  const [row] = await getDb()
    .select({
      max: sql<number>`coalesce(max(${dailyPlanTasks.sortOrder}), 0)::int`,
    })
    .from(dailyPlanTasks)
    .where(
      and(
        eq(dailyPlanTasks.userId, userId),
        date === null
          ? sql`${dailyPlanTasks.date} is null`
          : eq(dailyPlanTasks.date, date)
      )
    );
  return (row?.max ?? 0) + 1;
}

export async function createTask(input: TaskInput): Promise<PlanTask> {
  const userId = await me();
  const c = clean(input);
  if (!c.title) throw new Error("กรุณากรอกชื่องาน");

  const [row] = await getDb()
    .insert(dailyPlanTasks)
    .values({ userId, ...c, sortOrder: await nextOrder(userId, c.date) })
    .returning();
  return toTask(row);
}

export interface TaskPatch {
  title?: string;
  done?: boolean;
  date?: string | null;
  kind?: string | null;
  actionCategory?: string | null;
  targetQuantity?: number | null;
  notes?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder?: number;
}

export async function updateTask(id: string, patch: TaskPatch) {
  const userId = await me();
  const set: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new Error("กรุณากรอกชื่องาน");
    set.title = t;
  }
  if (patch.done !== undefined) set.done = !!patch.done;
  if (patch.date !== undefined)
    set.date = patch.date && ISO.test(patch.date) ? patch.date : null;
  if (patch.kind !== undefined) set.kind = patch.kind?.trim() || null;
  if (patch.actionCategory !== undefined)
    set.actionCategory = patch.actionCategory?.trim() || null;
  if (patch.targetQuantity !== undefined)
    set.targetQuantity = count(patch.targetQuantity);
  if (patch.notes !== undefined) set.notes = patch.notes?.trim() || null;
  if (patch.startTime !== undefined)
    set.startTime =
      patch.startTime && HHMM.test(patch.startTime) ? patch.startTime : null;
  if (patch.endTime !== undefined)
    set.endTime =
      patch.endTime && HHMM.test(patch.endTime) ? patch.endTime : null;
  if (patch.sortOrder !== undefined && Number.isFinite(patch.sortOrder))
    set.sortOrder = Math.round(patch.sortOrder);
  if (!Object.keys(set).length) return;

  await getDb()
    .update(dailyPlanTasks)
    .set(set)
    .where(and(eq(dailyPlanTasks.id, id), eq(dailyPlanTasks.userId, userId)));
}

export async function deleteTask(id: string) {
  const userId = await me();
  await getDb()
    .delete(dailyPlanTasks)
    .where(and(eq(dailyPlanTasks.id, id), eq(dailyPlanTasks.userId, userId)));
}

/** Put a deleted task back, WITH ITS ORIGINAL ID — undo's inverse of
    deleteTask. The id matters: a fresh uuid would strand every other undo
    entry that mentions this task. Safe because the row was hard-deleted and
    nothing references plan tasks by FK; onConflictDoNothing makes a
    double-undo a no-op. */
export async function restoreTask(task: PlanTask): Promise<void> {
  const userId = await me();
  const title = task.title.trim();
  if (!title) throw new Error("กรุณากรอกชื่องาน");

  await getDb()
    .insert(dailyPlanTasks)
    .values({
      id: task.id,
      userId,
      date: task.date && ISO.test(task.date) ? task.date : null,
      title,
      done: task.done,
      sortOrder: task.sortOrder,
      kind: task.kind,
      actionCategory: task.actionCategory,
      notes: task.notes,
      recurringId: task.recurringId,
      startTime: task.startTime,
      endTime: task.endTime,
      leadId: task.leadId,
      listingId: task.listingId,
    })
    .onConflictDoNothing();
}

/** Persist a drag: the day's tasks in their new order, one statement — a
    half-applied reorder is a scrambled day. */
export async function reorderTasks(orderedIds: string[]) {
  const userId = await me();
  if (!orderedIds.length) return;

  const cases = sql.join(
    orderedIds.map(
      (id, i) => sql`when ${dailyPlanTasks.id} = ${id}::uuid then ${i + 1}`
    ),
    sql` `
  );
  await getDb()
    .update(dailyPlanTasks)
    .set({ sortOrder: sql`case ${cases} else ${dailyPlanTasks.sortOrder} end` })
    .where(
      and(
        eq(dailyPlanTasks.userId, userId),
        inArray(dailyPlanTasks.id, orderedIds)
      )
    );
}

/* ---------- linked tasks → CRM ------------------------------------------- */

/** Complete a task that RECORDS AN ACTIVITY: write the `actions` row FIRST
    (plus the last-followed stamp when it points at a lead or listing), and
    only then mark the task done. If the write fails the task stays open — a
    task that says "done" over a record still sitting overdue is the drift
    this link exists to prevent. Throws on failure so the client can roll back.

    TWO WAYS A TASK EARNS THIS PATH, and they compose:

      it points at a lead or listing   a follow-up, promoted out of
                                       ติดตามวันนี้ — also resets the SLA clock
      it names an action_category      any planned activity (0019) — a Show, an
                                       Owner Visit, whatever was planned

    A task can be both, in which case the category it names wins over the
    "Follow" default: promoting an overdue lead and then marking the task as a
    Show should log a Show, not a follow-up, and the SLA stamp still lands
    because a showing is plainly a contact.

    `quantity` IS WHAT ACTUALLY HAPPENED (0026). The task carries a target —
    what you meant to do — and the tick asks you to confirm the real number
    before this runs. Passing it explicitly, rather than reading
    task.targetQuantity here, is the whole reason the two columns exist: a
    plan that said 5 must never log 5 on its own. Omit it and the activity
    records no count, exactly as every tick did before this.

    Was `completeFollowUp` until 2026-08-28; it does the same thing for a
    strictly larger set of tasks, so the follow-up-shaped name stopped being
    true rather than the behaviour changing. */
export async function completeTask(
  taskId: string,
  quantity?: number | null
) {
  const userId = await me();
  const db = getDb();
  const [task] = await db
    .select()
    .from(dailyPlanTasks)
    .where(
      and(eq(dailyPlanTasks.id, taskId), eq(dailyPlanTasks.userId, userId))
    )
    .limit(1);
  if (!task) throw new Error("ไม่พบงานนี้");

  const linked = !!(task.leadId || task.listingId);
  // Falls back to "Follow" only for a linked task with no category of its
  // own — that is the promotion route, and Follow is what it has always
  // logged. An unlinked task with no category never reaches here.
  const category = task.actionCategory ?? (linked ? "Follow" : null);
  if (!category) throw new Error("งานนี้ไม่ได้ผูกกับรายการหรือประเภทกิจกรรม");

  const today = bkkToday();
  // The activity is the record of the work — the scoreboard reads it. Returned
  // so the log card can splice the new row in without a refetch.
  const [logged] = await db
    .insert(actions)
    .values({
      date: today,
      agentId: userId,
      category,
      quantity: count(quantity),
      remark: task.title,
      leadId: task.leadId,
      listingId: task.listingId,
      // The link that lets deleteActivity un-tick this task again (0022).
      taskId: task.id,
    })
    .returning({
      id: actions.id,
      category: actions.category,
      quantity: actions.quantity,
      hours: actions.hours,
      remark: actions.remark,
      recap: actions.recap,
      taskId: actions.taskId,
    });
  if (task.leadId) {
    await db
      .update(leads)
      .set({ lastFollowedAt: today })
      .where(eq(leads.id, task.leadId));
  }
  if (task.listingId) {
    await db
      .update(listings)
      .set({ lastFollowedAt: today })
      .where(eq(listings.id, task.listingId));
  }
  await db
    .update(dailyPlanTasks)
    .set({ done: true })
    .where(eq(dailyPlanTasks.id, taskId));

  return { ...logged, linked } as DayActivity;
}

/* ---------- กิจกรรมวันนี้ -------------------------------------------------- */

/* THE ADD SIDE OF THIS SECTION IS GONE (Ben, 2026-08-30). `logActivity` wrote
   an `actions` row straight from the card's own form — a second door into the
   same table beside completeTask above, which is what the merge removed. An
   activity now arrives ONE way: put it in the plan, tick it. So this card
   still shows the day and still takes a row back out; what it no longer does
   is create one. */

/** Remove an activity logged today.

    THE MISTAKE ROUTE, ADDED BECAUSE THERE WASN'T ONE (Ben, 2026-08-29). This
    card shipped append-only on the argument that "a mistake is corrected by
    logging the truth, not by rewriting the record" — which is right for a
    ledger and wrong for a day's tally that a person types in a hurry on a
    phone. Logging a compensating Show is not a thing anyone can do; there is
    no negative Show. So a typo made an hour ago was permanent, and the only
    way to keep the scoreboard honest was to never mistype.

    THREE LIMITS, and each is the reason this stays safe rather than becoming
    a general edit-your-numbers tool:

      own rows only     agent_id is taken from the SESSION and pinned in the
                        `where`, so a forged id deletes nothing.
      TODAY only        yesterday's figures have been read. A day rolls over
                        and closes; correcting it is a conversation with a
                        manager, not a click.
      not follow-ups    a row carrying a lead or listing also moved that
                        record's last_followed_at, and the value it replaced
                        is gone. Deleting the activity would leave the record
                        claiming a follow-up that no longer exists anywhere —
                        worse than the typo. See the note below on the fix.

    A HARD DELETE, NOT A VOID FLAG. Nothing in this app soft-deletes, and a
    `voided` column would put a filter on every scoreboard query forever to
    preserve rows whose entire content is "someone typed 5 instead of 2 and
    noticed". The audit trail worth having here is the daily one, and it is
    intact: only the current day can be touched at all.

    When the row came from ticking a task, the task is un-ticked with it.
    That is the whole point of storing task_id — the alternative is a task
    still marked done over an activity that no longer exists. */
export async function deleteActivity(
  id: string
): Promise<{ ok: true; taskId: string | null } | { ok: false; reason: "linked" | "gone" }> {
  const userId = await me();
  const db = getDb();

  const [row] = await db
    .select({
      id: actions.id,
      taskId: actions.taskId,
      leadId: actions.leadId,
      listingId: actions.listingId,
    })
    .from(actions)
    .where(
      and(
        eq(actions.id, id),
        eq(actions.agentId, userId),
        eq(actions.date, bkkToday())
      )
    )
    .limit(1);
  if (!row) return { ok: false, reason: "gone" };
  if (row.leadId || row.listingId) return { ok: false, reason: "linked" };

  await db.delete(actions).where(eq(actions.id, row.id));
  if (row.taskId) {
    await db
      .update(dailyPlanTasks)
      .set({ done: false })
      .where(
        and(eq(dailyPlanTasks.id, row.taskId), eq(dailyPlanTasks.userId, userId))
      );
  }
  return { ok: true, taskId: row.taskId };
}

/* ---------- ติดตามวันนี้ → the plan ---------------------------------------- */

/* logFollowUp lived here — the ✓ on ติดตามวันนี้. It wrote a bare "Follow"
   row carrying the record's name and nothing else, which cleared the queue
   and left the history saying only that *something* happened. Removed with
   the button (Ben, 2026-08-30): a follow is now written on the record.
*/
export async function promoteToPlan(
  side: "lead" | "listing",
  id: string
): Promise<PlanTask> {
  const userId = await me();
  const db = getDb();
  const date = bkkToday();

  const name = await recordName(side, id);
  if (!name) throw new Error("ไม่พบรายการนี้");

  // Already on this person's plan and still open → hand back the existing row
  // rather than stacking duplicates when the card is double-tapped.
  const [existing] = await db
    .select()
    .from(dailyPlanTasks)
    .where(
      and(
        eq(dailyPlanTasks.userId, userId),
        eq(dailyPlanTasks.done, false),
        side === "lead"
          ? eq(dailyPlanTasks.leadId, id)
          : eq(dailyPlanTasks.listingId, id)
      )
    )
    .limit(1);
  if (existing) return toTask(existing);

  const [{ max }] = await db
    .select({
      max: sql<number>`coalesce(max(${dailyPlanTasks.sortOrder}), 0)::int`,
    })
    .from(dailyPlanTasks)
    .where(and(eq(dailyPlanTasks.userId, userId), eq(dailyPlanTasks.date, date)));

  const [row] = await db
    .insert(dailyPlanTasks)
    .values({
      userId,
      date,
      title: `ติดตาม ${name}`,
      sortOrder: (max ?? 0) + 1,
      leadId: side === "lead" ? id : null,
      listingId: side === "listing" ? id : null,
    })
    .returning();

  return toTask(row);
}

/** The record's display name, for the task title and the activity remark.

    NOT viewer-scoped: the id can only have come from getFollowUps(), which is
    already scoped, and both callers pin every write to the session user. A
    scope check here would be a second, weaker copy of that rule. */
async function recordName(
  side: "lead" | "listing",
  id: string
): Promise<string | null> {
  const db = getDb();
  if (side === "lead") {
    const [row] = await db
      .select({ name: contacts.name, code: leads.legacyCode })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(eq(leads.id, id))
      .limit(1);
    if (!row) return null;
    return row.name?.trim() || row.code || "ลูกค้าไม่ระบุชื่อ";
  }
  const [row] = await db
    .select({ name: listings.listingName, code: listings.legacyCode })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!row) return null;
  return row.name?.trim() || row.code || "ทรัพย์ไม่ระบุชื่อ";
}

/* ---------- recurring rules ----------------------------------------------- */

export interface RuleInput {
  title: string;
  notes?: string | null;
  kind?: string | null;
  actionCategory?: string | null;
  /** Copied onto every instance the rule produces (0026). */
  targetQuantity?: number | null;
  freq: string;
  weekdays?: string | null;
  dayOfMonth?: number | null;
  startTime?: string | null;
  endTime?: string | null;
}

export async function createRecurring(input: RuleInput): Promise<RecurRule> {
  const userId = await me();
  const title = (input.title ?? "").trim();
  if (!title) throw new Error("กรุณากรอกชื่องาน");
  const freq = normalizeFreq(input.freq);

  const weekdays =
    freq === "weekly"
      ? [
          ...new Set(
            String(input.weekdays ?? "")
              .split(",")
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
          ),
        ]
          .sort()
          .join(",")
      : null;
  // A weekly rule with no weekday would apply on no day at all — a rule that
  // silently never fires is worse than a rejected one.
  if (freq === "weekly" && !weekdays)
    throw new Error("เลือกวันในสัปดาห์อย่างน้อยหนึ่งวัน");

  const dayOfMonth =
    freq === "monthly"
      ? Math.min(31, Math.max(1, Math.round(Number(input.dayOfMonth) || 1)))
      : null;

  const time = (v: string | null | undefined) => (v && HHMM.test(v) ? v : null);

  const [row] = await getDb()
    .insert(planRecurring)
    .values({
      userId,
      title,
      notes: input.notes?.trim() || null,
      kind: input.kind?.trim() || null,
      actionCategory: input.actionCategory?.trim() || null,
      targetQuantity: count(input.targetQuantity),
      freq,
      weekdays,
      dayOfMonth,
      // Forward-only: a rule created today never claims yesterday.
      startDate: bkkToday(),
      startTime: time(input.startTime),
      endTime: time(input.endTime),
    })
    .returning();
  return toRule(row);
}

/** Edit a rule — including `{ active: false }` to stop the series. Future
    days only: instances already materialized stay exactly as they are. */
export async function updateRecurring(
  id: string,
  patch: { active?: boolean; title?: string }
) {
  const userId = await me();
  const set: Record<string, unknown> = {};
  if (patch.active !== undefined) set.active = !!patch.active;
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new Error("กรุณากรอกชื่องาน");
    set.title = t;
  }
  if (!Object.keys(set).length) return;
  await getDb()
    .update(planRecurring)
    .set(set)
    .where(and(eq(planRecurring.id, id), eq(planRecurring.userId, userId)));
}

export async function deleteRecurring(id: string) {
  const userId = await me();
  await getDb()
    .delete(planRecurring)
    .where(and(eq(planRecurring.id, id), eq(planRecurring.userId, userId)));
}

/** Turn due rules into real task rows for one day.

    LAZY, not scheduled — called whenever the card shows a day ≥ today. No
    cron, no backfill, and no rows appearing in the past (which would turn a
    streak-bridging "no plan" day into a streak-breaking unfinished one).
    Idempotent twice over: the pending check skips rules that already have an
    instance, and the partial unique index makes a race a no-op. */
export async function materializeRecurring(date: string): Promise<PlanTask[]> {
  const userId = await me();
  if (!ISO.test(date)) throw new Error("วันที่ไม่ถูกต้อง");
  if (date < bkkToday()) return [];
  const db = getDb();

  const [rules, dayRows] = await Promise.all([
    db
      .select()
      .from(planRecurring)
      .where(
        and(eq(planRecurring.userId, userId), eq(planRecurring.active, true))
      ),
    db
      .select()
      .from(dailyPlanTasks)
      .where(
        and(eq(dailyPlanTasks.userId, userId), eq(dailyPlanTasks.date, date))
      ),
  ]);

  const existing = dayRows.map(toTask);
  const due = pendingRules(rules.map(toRule), existing, date);
  if (!due.length) return [];

  let order = existing.reduce((m, t) => Math.max(m, t.sortOrder), 0);
  const rows = await db
    .insert(dailyPlanTasks)
    .values(
      due.map((r) => {
        order += 1;
        return {
          userId,
          date,
          title: r.title,
          sortOrder: order,
          kind: r.kind,
          actionCategory: r.actionCategory,
          targetQuantity: r.targetQuantity,
          notes: r.notes,
          recurringId: r.id,
          startTime: r.startTime,
          endTime: r.endTime,
        };
      })
    )
    .onConflictDoNothing()
    .returning();

  return rows.map(toTask);
}

/* ---------- day offs ------------------------------------------------------ */

export async function setDayOff(date: string, off: boolean) {
  const userId = await me();
  if (!ISO.test(date)) throw new Error("วันที่ไม่ถูกต้อง");
  if (off) {
    await getDb()
      .insert(planDayoffs)
      .values({ userId, date })
      .onConflictDoNothing();
  } else {
    await getDb()
      .delete(planDayoffs)
      .where(and(eq(planDayoffs.userId, userId), eq(planDayoffs.date, date)));
  }
}

/* ---------- recap --------------------------------------------------------- */

export async function saveRecap(
  date: string,
  patch: { good?: string; lesson?: string; tomorrow?: string }
) {
  const userId = await me();
  if (!ISO.test(date)) throw new Error("วันที่ไม่ถูกต้อง");
  const values = {
    userId,
    date,
    good: patch.good?.trim() || null,
    lesson: patch.lesson?.trim() || null,
    tomorrow: patch.tomorrow?.trim() || null,
  };
  await getDb()
    .insert(planRecaps)
    .values(values)
    .onConflictDoUpdate({
      target: [planRecaps.userId, planRecaps.date],
      set: {
        good: values.good,
        lesson: values.lesson,
        tomorrow: values.tomorrow,
      },
    });
}

/* ---------- prefs --------------------------------------------------------- */

/** MERGE, never replace. Two independent keys live in this bag (the weekly
    day-off rule and its opt-out dates), written by different interactions —
    a blind overwrite would have one silently erase the other. */
export async function savePlanPrefs(patch: Record<string, unknown>) {
  const userId = await me();
  await getDb()
    .insert(planPrefs)
    .values({ userId, prefs: patch })
    .onConflictDoUpdate({
      target: planPrefs.userId,
      set: {
        prefs: sql`${planPrefs.prefs} || ${JSON.stringify(patch)}::jsonb`,
      },
    });
}
