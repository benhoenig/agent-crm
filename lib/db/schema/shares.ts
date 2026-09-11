import {
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { contacts } from "./contacts";
import { leads } from "./sales";
import { listings } from "./property";

// Buyer share rooms + owner report links (ported from the Klaichan/Mook
// CRM's most-loved outward feature). Both are TOKEN doors: an unguessable
// URL a customer taps in LINE, no login, scoped server-side to exactly the
// rows that token names — never through the viewer scope system.

/** A shortlist sent to one buyer: /share/{token}. */
export const shares = pgTable(
  "shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Revoked = the door is closed; the row and its feedback history stay. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
  },
  (t) => [index("shares_lead_idx").on(t.leadId)]
);

/** The listings in a share, with the buyer's verdict written back onto the
    row (current state) — the events table below keeps the history. */
export const shareListings = pgTable(
  "share_listings",
  {
    shareId: uuid("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    feedback: text("feedback").$type<"interested" | "rejected">(),
    feedbackReasons: text("feedback_reasons").array(),
    feedbackAt: timestamp("feedback_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.shareId, t.listingId] })]
);

/** Append-only log of buyer verdicts — a buyer who changes their mind is
    itself signal, so the current state alone is not enough. */
export const shareFeedbackEvents = pgTable(
  "share_feedback_events",
  {
    id: serial("id").primaryKey(),
    shareId: uuid("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"interested" | "rejected">().notNull(),
    reasons: text("reasons").array(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("share_feedback_share_idx").on(t.shareId)]
);

/** A seller's progress page: /owner-report/{token} — every listing whose
    owner_id matches, with marketing activity. One live link per owner. */
export const ownerLinks = pgTable(
  "owner_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
  },
  (t) => [index("owner_links_owner_idx").on(t.ownerId)]
);
