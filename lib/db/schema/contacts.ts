import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ONE person table (merged 2026-08-25). There used to be a second, `owners`,
// with the same columns — an artifact of the import having two sources: owner
// details embedded in listing columns P–R, and buyer details on Active Lead.
// Nothing about the business wanted two tables, and the split had already put
// six people in both, co-agents included.
//
// A person's ROLE is the relationship, not the table: listings.owner_id points
// here for the seller, leads.contact_id for the buyer. Privacy is unchanged and
// still relationship-based — sales see owner details only on their own listings
// (DATA_MODEL §5, canSeeOwnerOn).
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    phone: text("phone"),
    lineId: text("line_id"),
    email: text("email"),
    gender: text("gender"),
    nationality: text("nationality"),
    ageRange: text("age_range"),
    remark: text("remark"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Phone is THE dedupe key every save resolves on — see 0024. Partial
  // because a person with no number is ordinary, and those must not collide
  // with each other. It is also the only index this column needs: a plain
  // one alongside it answered the same `phone = $1` lookups and was dropped
  // in 0025.
  (t) => [
    uniqueIndex("contacts_phone_unique")
      .on(t.phone)
      .where(sql`${t.phone} is not null`),
  ]
);
