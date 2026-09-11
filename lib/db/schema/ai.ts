import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// The AI parse queue (ported from the Klaichan/Mook CRM). A paste is a ROW,
// not a promise living in a browser tab: enqueue returns in milliseconds,
// the extraction runs detached on the server, and the draft is waiting in
// the tray on any page, any device, after any refresh. Jobs are never
// deleted: consumedAt hides them and `outcome` records whether the draft
// was saved — "saved vs discarded" over time is the only honest measure of
// whether the extractor is good enough.
export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"listing" | "lead">().notNull(),
    status: text("status")
      .$type<"queued" | "running" | "done" | "error">()
      .notNull()
      .default("queued"),
    rawText: text("raw_text").notNull(),
    /** ListingParseDraft | LeadParseDraft (lib/ai/parse.ts). */
    draft: jsonb("draft"),
    /** The Thai banner the parse produced ("จับคู่โครงการ …"). */
    note: text("note"),
    /** Thai user-facing failure text, already mapped from the error code. */
    error: text("error"),
    /** Short label for the tray — project/person name, else first line. */
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set when the runner picks it up; also how a stuck job is detected. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    outcome: text("outcome").$type<"saved" | "discarded">(),
  },
  (t) => [index("ai_jobs_user_open_idx").on(t.userId, t.consumedAt)]
);

/** Best-effort token log — the spend panel's raw data. */
export const aiUsage = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  kind: text("kind").$type<"listing" | "lead">().notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
