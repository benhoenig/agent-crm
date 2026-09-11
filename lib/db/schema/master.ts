import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { slaEntity, stationType } from "./enums";

// 16 live Bangkok CBD zones from the central Zone tab; new zones via /settings.
export const zones = pgTable("zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  legacyCode: text("legacy_code").unique(), // "ZONE-01"
  code: text("code").notNull().unique(), // "SAT-001"
  nameEng: text("name_eng").notNull(),
  nameThai: text("name_thai"),
  location: text("location"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Full BTS/MRT/ARL masters from the Resources tab.
export const transitStations = pgTable(
  "transit_stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: stationType("type").notNull(),
    code: text("code").notNull(), // "N24", "BL01", "A1"
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("transit_stations_type_code_idx").on(t.type, t.code)]
);

// Follow-up SLAs previously encoded in sheet conditional formatting
// (DATA_MODEL §1.7). Drives overdue flags + the daily-plan queue.
export const slaRules = pgTable(
  "sla_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entity: slaEntity("entity").notNull(),
    potential: text("potential").notNull(), // A | B | C | Exclusive
    maxDays: integer("max_days").notNull(),
  },
  (t) => [uniqueIndex("sla_rules_entity_potential_idx").on(t.entity, t.potential)]
);

// LINE group allowlist for the /plan webhook (DATA_MODEL §7).
export const lineGroups = pgTable("line_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  lineGroupId: text("line_group_id").notNull().unique(),
  name: text("name"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
