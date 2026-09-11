import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { goalStatus, leaveStatus, leaveType, recap } from "./enums";
import { users } from "./auth";
import { listings } from "./property";
import { leads } from "./sales";

// Activity log (per-agent Actions tab + historic LINE-parsed central Action).
// listing/lead FKs are for future row-linking — sheet data has none.
export const actions = pgTable(
  "actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id),
    /** options "action_category" — NULL is a plain note (0027): it shows in
        the record's history, counts toward nothing, and does not stamp the
        SLA clock. The tag is the claim that work happened. */
    category: text("category"),
    quantity: integer("quantity"),
    hours: numeric("hours", { precision: 5, scale: 2 }),
    remark: text("remark"),
    recap: recap("recap"),
    whatHappened: text("what_happened"),
    why: text("why"),
    improvementPlan: text("improvement_plan"),
    listingId: uuid("listing_id").references(() => listings.id),
    leadId: uuid("lead_id").references(() => leads.id),
    /** The plan task whose tick wrote this row, when one did (0022). NULL for
        a hand-logged activity and for every historic row. Stored so that
        removing an activity can un-tick the task behind it — otherwise the
        task would keep claiming work with no record of it. */
    taskId: uuid("task_id").references(() => dailyPlanTasks.id, {
      onDelete: "set null",
    }),
    /** Withdrawn (0027) — filed by mistake. The row STAYS, struck through
        and restorable, because a count that dropped needs a reason someone
        can point at. Every aggregate in the app filters these out. */
    voided: boolean("voided").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("actions_agent_date_idx").on(t.agentId, t.date)]
);

/* Per-agent activity targets — the numbers the ความเคลื่อนไหว card scores
   each funnel step and each owner-side category against.

   SEPARATE FROM `goals` BELOW, and deliberately. A goal is a named, dated
   commitment with a retro attached ("Q3 push", ฿2M, Jul–Sep, what happened /
   why / improvement plan). A target here is a standing rate — "12 shows a
   month" — with no name, no window of its own and nothing to write up. They
   answer different questions and one table would have made every column of
   each one nullable for the other.

   TWO LEVELS, ported from Klaichan. `period_key = ''` is the STANDING target
   for that period length; a row with a real key ('2026-08') overrides that one
   period. The resolver prefers the exact key and falls back to the standing
   row, so a seasonal month can be set without re-entering every other month,
   and the common case stays one number typed once.

   PER AGENT, unlike Klaichan's company-wide table — see lib/targets.ts for
   why. */
export const agentTargets = pgTable(
  "agent_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** lib/targets.ts vocabulary: `stage:Show` · `kind:Owner Talk`. */
    metric: text("metric").notNull(),
    /** month | quarter | year — the LENGTH targeted, not a date range. */
    period: text("period").notNull(),
    /** '' = the standing target for this period length. */
    periodKey: text("period_key").notNull().default(""),
    /** Whole units. A target of 12.5 shows is not a target anyone set. */
    amount: integer("amount").notNull(),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("agent_targets_agent_metric_period_idx").on(
      t.agentId,
      t.metric,
      t.period,
      t.periodKey
    ),
  ]
);

// Goals & Target (13 cols) incl. retro fields.
export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  agentId: uuid("agent_id").references(() => users.id),
  goalType: text("goal_type"),
  targetAmount: numeric("target_amount", { precision: 14, scale: 2 }),
  startDate: date("start_date"),
  targetDate: date("target_date"),
  status: goalStatus("status").notNull().default("Planned"),
  remark: text("remark"),
  recap: recap("recap"),
  whatHappened: text("what_happened"),
  why: text("why"),
  improvementPlan: text("improvement_plan"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Tool-feedback log from the agent sheets.
export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date"),
  userId: uuid("user_id").references(() => users.id),
  category: text("category"),
  tool: text("tool"),
  feedback: text("feedback"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type"),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)]
);

/* WHO LOOKED AT THE MARKET INTELLIGENCE (Ben, 2026-09-11: "it's valuable data
   that we want to see who's been looking at it and have weird behaviors").

   THE ONLY TABLE IN THIS APP THAT RECORDS A READ. Everything else here logs a
   CHANGE — listing_updates, actions, notifications — because a change has an
   author who meant it. A read log is a different instrument and a heavier one,
   so it covers exactly two surfaces and no more: the โครงการ survey (616 deep
   competitor write-ups) and Last Match (closed prices and buyer personas).
   Those are the two things an agent could walk out with that would still be
   worth something to a competitor next year.

   IT IS FORENSIC, NOT PREVENTIVE, and the difference matters when reading it:
   nothing here stops a screenshot, a phone camera, or a person typing notes by
   hand. What it answers is "who read how much, and when" — because the signal
   that someone is leaving with the database is VOLUME, not any single open.
   Somebody who reads five surveys a week and then reads three hundred over two
   evenings is the whole reason this exists.

   `record_id` IS NULLABLE because a list view exposes many rows at once and
   has no single id to point at; `rows` says how many were on screen. A detail
   open is the same shape with rows = 1, so one report can sum both.

   NO CASCADE ON user_id, deliberately, and it is the one place in this schema
   that omits it. An audit trail that erases itself the moment the person under
   suspicion is deleted is not an audit trail. Departing staff are BANNED here
   rather than deleted (lib/auth admin plugin), so nothing routine collides
   with this. */
export const recordViews = pgTable(
  "record_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    /** 'project' | 'last_match' — validated in code, not by an enum, so
        covering a third surface later is not a migration. */
    entity: text("entity").notNull(),
    /** The record opened, or NULL for a list view — see the header. */
    recordId: uuid("record_id"),
    /** How many records this view put in front of them. 1 for a detail open,
        the rendered row count for a list. What the report sums. */
    rows: integer("rows").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // "how much did this person read, by day" — the report's main question.
    index("record_views_user_idx").on(t.userId, t.createdAt),
    // "who has opened THIS survey" — the per-record history on the record.
    index("record_views_record_idx").on(t.entity, t.recordId, t.createdAt),
  ]
);

// Leave module ships in v1 with an empty start (decided 2026-08-15).
export const leaveAllowances = pgTable(
  "leave_allowances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    sickDays: numeric("sick_days", { precision: 4, scale: 1 }),
    personalDays: numeric("personal_days", { precision: 4, scale: 1 }),
    vacationDays: numeric("vacation_days", { precision: 4, scale: 1 }),
  },
  (t) => [uniqueIndex("leave_allowances_user_year_idx").on(t.userId, t.year)]
);

export const leaves = pgTable(
  "leaves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    type: leaveType("type").notNull(),
    status: leaveStatus("status").notNull().default("pending"),
    approvedBy: uuid("approved_by").references(() => users.id),
    remark: text("remark"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("leaves_user_idx").on(t.userId)]
);

// The agent's own planned tasks backing /today, /plan and the LINE card.
// SLA-generated queue items are computed at read time, never stored here.
// Extended 2026-08-23 with the full planner port (Klaichan/Mook → Habihub):
// NULL date = backlog, recurring rules materialize lazily into rows here,
// start/end times are text labels ("HH:MM") — a time-of-day, never an
// instant, so no zone and no maths.
export const dailyPlanTasks = pgTable(
  "daily_plan_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** NULL = backlog — captured but not yet scheduled. The absence of a day
        IS the backlog; a separate flag could disagree with the date. */
    date: date("date"),
    sortOrder: integer("sort_order").notNull().default(0),
    title: text("title").notNull(),
    done: boolean("done").notNull().default(false),
    /** options "task_type" — colours the row and the ratio bar only. */
    kind: text("kind"),
    /** options "action_category" — the SCOREBOARD's vocabulary, deliberately
        not `kind` above (see migration 0019). When set, ticking this task
        writes an `actions` row; when null it ticks like an ordinary to-do. */
    actionCategory: text("action_category"),
    /** How many you MEANT to do ("call 5 owners") — 0026. Ticking pre-fills
        the confirm box with it and logs what you confirm, so this stays the
        intention and actions.quantity stays the record. NULL on the tasks
        that are not countable, which is most of them. */
    targetQuantity: integer("target_quantity"),
    notes: text("notes"),
    /** Which rule materialized this task. DELIBERATELY NOT A FOREIGN KEY:
        stopping or deleting a series must not rewrite the days it already
        produced. */
    recurringId: uuid("recurring_id"),
    listingId: uuid("listing_id").references(() => listings.id),
    leadId: uuid("lead_id").references(() => leads.id),
    startTime: text("start_time"),
    endTime: text("end_time"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("daily_plan_tasks_user_date_idx").on(t.userId, t.date),
    // Idempotency for lazy materialization — one instance per rule per day,
    // enforced even when two devices open tomorrow at once.
    uniqueIndex("daily_plan_tasks_recurring_day_idx")
      .on(t.recurringId, t.date)
      .where(sql`${t.recurringId} is not null`),
  ]
);

/** A repeating task, stored as a RULE rather than as rows stretching into
    the future. Instances are materialized lazily the first time a day ≥
    today is opened — no cron, no backfill, and changing a rule cannot
    rewrite history it already wrote. */
export const planRecurring = pgTable(
  "plan_recurring",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    kind: text("kind"),
    /** options "action_category", copied onto every instance this rule
        materializes — see daily_plan_tasks.action_category (0019). */
    actionCategory: text("action_category"),
    /** Copied onto every instance too (0026) — a daily "โทร 10 สาย" carries
        its 10 into each day it produces. */
    targetQuantity: integer("target_quantity"),
    /** daily | weekdays | weekly | monthly — fixed vocabulary (lib/plan.ts),
        each value is a different branch of date arithmetic. */
    freq: text("freq").notNull().default("daily"),
    /** freq='weekly': comma list of JS weekday numbers (0=Sun … 6=Sat). */
    weekdays: text("weekdays"),
    dayOfMonth: integer("day_of_month"),
    startDate: date("start_date"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    /** Stopping a series sets this false — the rule is kept, not deleted,
        so instances it already produced still resolve their origin. */
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("plan_recurring_user_idx").on(t.userId, t.active)]
);

/** A day marked วันหยุด in the planner — a personal "not working today",
    distinct from formal HR leave (the leaves table): both bridge the streak,
    but only leave goes through an approval. The planner reads the UNION. */
export const planDayoffs = pgTable(
  "plan_dayoffs",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("plan_dayoffs_user_date_idx").on(t.userId, t.date)]
);

/** End-of-day reflection. `tomorrow` is surfaced the next morning as a
    one-tap "add as task" — the only field that feeds back into the plan. */
export const planRecaps = pgTable(
  "plan_recaps",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    good: text("good"),
    lesson: text("lesson"),
    tomorrow: text("tomorrow"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("plan_recaps_user_date_idx").on(t.userId, t.date)]
);

/** Per-user planner preferences (weekly day-off rule + its opt-out dates).
    JSONB because it is a bag of small preferences, never queried across
    users. Writes MERGE, never replace (see savePlanPrefs). */
export const planPrefs = pgTable("plan_prefs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  prefs: jsonb("prefs").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* Per-person column layout for the Sheets-style grids (0020).

   PORTED FROM Klaichan's table_prefs with the SheetTable it serves.

   BOTH LISTS ARE ADVISORY, NEVER AUTHORITATIVE. The code's column registry is
   the source of truth for which columns EXIST; these two arrays are filtered
   through it on read (lib/tables/index.ts `resolve`). So a column removed in a
   release disappears from a stale saved order instead of rendering as a blank
   strip, and a column ADDED in a release appears — visible, in its registry
   position — rather than being invisible to everyone who ever opened the
   manager.

   NOT IN plan_prefs' jsonb bag: that one is a per-user singleton keyed by
   user alone, and this is one row PER GRID. Sharing it would have made
   "reset this table" a read-modify-write of every other table's layout. */
export const tablePrefs = pgTable(
  "table_prefs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Which grid — 'listings' | 'leads'. Free text, validated in code
        against the registry, so adding a configurable table is not a
        migration. */
    tableKey: text("table_key").notNull(),
    /** Column keys in display order. Empty = the registry's own order. */
    columnOrder: jsonb("column_order").$type<string[]>().notNull().default([]),
    /** Column keys the user switched OFF. Hidden rather than "visible" so the
        default for a column nobody has an opinion about is SHOWN — which is
        what makes a newly shipped column discoverable. */
    hidden: jsonb("hidden").$type<string[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tableKey] })]
);
