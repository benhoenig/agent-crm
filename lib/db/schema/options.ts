import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Editable picklists — the business vocabulary that used to be pg enums
// (converted 2026-08-23, pre-launch, so new values stop costing a migration).
//
// `key` IS the stored value in referencing rows and the text shown in the UI —
// the sheets' vocabulary stays verbatim-readable in the data. Renaming a value
// therefore rewrites the referencing columns in the same transaction (the
// kind → columns registry lives in lib/options/kinds.ts). Code never matches
// on key: anything the app branches on is tagged with `role`, so the client
// can rename "ขายแล้ว" without breaking the dashboards that count wins.
export const options = pgTable(
  "options",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    /** Pill/Dot tone token (good/warn/bad/info/accent/muted) — null renders muted. */
    tone: text("tone"),
    /** Behavior tag the app branches on (lib/options/kinds.ts OptionRole). */
    role: text("role"),
    /** ledger_category only: which P&L block this line rolls into
        (lib/ledger.ts LedgerSection). */
    section: text("section"),
    /** Cross-reference to another option's key — payout_role rows point at
        the ledger_category their paid legs post to. Deliberately not an FK:
        an unresolvable link falls back in code, never cascades. */
    linkedKey: text("linked_key"),
    /** action_category only: which `pipeline_stage` this category ADVANCES.

        The funnel and the activity log share vocabulary — Call, Follow,
        Appoint, Show, Nego and Close are both an action you log and a step a
        lead reaches — but sharing a spelling is a coincidence, not a link.
        Klaichan's notes are explicit that matching the two lists by label
        "only agreed by coincidence of labels" until a real column existed, so
        this is that column rather than a string compare. NULL for every
        owner-scope category: acquisition advances no buyer stage. */
    stageKey: text("stage_key"),
    /** action_category only: `owner` (acquisition — signing up a unit,
        talking to a landlord) or `buyer` (moving a lead down the funnel).
        Drives the two halves of the ความเคลื่อนไหว card, so the split can
        never drift from what is set in Settings. NULL = uncategorised, which
        is absent from both halves rather than guessed into one. */
    scope: text("scope"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Archived rows keep old data renderable but leave the pickers. */
    archived: boolean("archived").notNull().default(false),
    /** Load-bearing rows (their role backs a predicate) — cannot be archived. */
    system: boolean("system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("options_kind_key_idx").on(t.kind, t.key),
    index("options_kind_sort_idx").on(t.kind, t.sortOrder),
  ]
);
