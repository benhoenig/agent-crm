import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { listingUpdateStatus, mediaKind } from "./enums";
import { users } from "./auth";
import { zones, transitStations } from "./master";
import { contacts } from "./contacts";

// 49-col project knowledge base from the agent sheets. Most quantity-ish
// fields are free text in the source ("ประมาณ 2,248 ยูนิต", "45 บาท/ตรม./เดือน")
// so they stay text — never numeric-parsed at import.
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  legacyCode: text("legacy_code").unique(),
  nameEng: text("name_eng"),
  nameThai: text("name_thai"),
  propertyType: text("property_type"), // source vocabulary ("Condo High-rise") differs from listing enum
  zoneId: uuid("zone_id").references(() => zones.id),
  zoneRaw: text("zone_raw"), // unmatched "Zone / Area" text kept for provenance
  developer: text("developer"),
  yearBuilt: text("year_built"),
  buildings: text("buildings"),
  floors: text("floors"),
  units: text("units"),
  parkingRatio: text("parking_ratio"),
  extraParkingPurchasable: text("extra_parking_purchasable"),
  extraParkingFee: text("extra_parking_fee"),
  highlights: text("highlights"),
  commonFacilities: text("common_facilities"),
  commonFee: text("common_fee"),
  commonFeeTerms: text("common_fee_terms"),
  commonFeeCollectionPct: text("common_fee_collection_pct"),
  juristicPerson: text("juristic_person"),
  avgPricePerSqm: text("avg_price_per_sqm"),
  rentalYield: text("rental_yield"),
  unitTypes: text("unit_types"),
  ceilingHeight: text("ceiling_height"),
  unitsPerFloor: text("units_per_floor"),
  segment: text("segment"),
  comparables: text("comparables"),
  bestView: text("best_view"),
  bestDirection: text("best_direction"),
  bestPosition: text("best_position"),
  nationalityMix: text("nationality_mix"),
  petsAllowed: text("pets_allowed"),
  smokingAllowed: text("smoking_allowed"),
  shops: text("shops"),
  nearestStationInfo: text("nearest_station_info"),
  shuttleInfo: text("shuttle_info"),
  keywords: text("keywords"),
  targetCustomers: text("target_customers"),
  concept: text("concept"),
  pros: text("pros"),
  cons: text("cons"),
  quakeRepairHistory: text("quake_repair_history"),
  quakeSafetyCert: text("quake_safety_cert"),
  quakeInsurance: text("quake_insurance"),
  quakeExteriorCracks: text("quake_exterior_cracks"),
  quakeJointsCondition: text("quake_joints_condition"),
  quakeInteriorCondition: text("quake_interior_condition"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Agent sheets store Persona 1–10 as columns; normalized to rows here.
export const projectPersonas = pgTable(
  "project_personas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    salesId: uuid("sales_id").references(() => users.id),
    persona: text("persona").notNull(),
    trustTrigger: text("trust_trigger"), // options kind "trust_trigger"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("project_personas_project_idx").on(t.projectId)]
);

/* Photos of the project itself (Ben, 2026-09-11: "ใส่รูปได้ + ปรับให้ format
   อ่านง่ายขึ้นเหมือนดูทรัพย์ใน website").

   SEPARATE FROM listing_media, not a widened version of it. A listing photo is
   of one unit and dies with that listing (cascade); a project photo is of the
   lobby, the pool, the view down the corridor — it outlives every listing in
   the building and is what makes the survey readable as a place rather than a
   spreadsheet. Sharing one table would have meant a nullable listing_id and a
   nullable project_id with a check constraint keeping exactly one of them set,
   which is two tables wearing a trench coat.

   CAPTION, NOT `kind`. listing_media carries a mediaKind enum because a
   listing's photos answer fixed questions (floorplan / unit / building). A
   survey photo answers whatever the surveyor saw worth photographing, and the
   useful label is their words — "ล็อบบี้ชั้น 1", "วิวทิศเหนือจากชั้น 20". An
   enum here would have been a vocabulary nobody could extend without a
   migration, on the one table whose whole point is what one person noticed. */
export const projectMedia = pgTable(
  "project_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    /** The surveyor's own label for what this shows. Optional — an unlabelled
        photo of a lobby is still worth more than no photo. */
    caption: text("caption"),
    /** First by sort order is the COVER — what the list and the top of the
        record show. Reordering is therefore how you choose the cover, with no
        separate is_cover flag that could disagree with it. */
    sortOrder: integer("sort_order").notNull().default(0),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("project_media_project_idx").on(t.projectId, t.sortOrder)]
);

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyCode: text("legacy_code").unique(), // "HBH-ST-1" / "SAT001" / "TDMK007"
    listingName: text("listing_name"),
    status: text("status").notNull().default("ข้อมูลยังไม่ครบ"), // options "listing_status"
    potential: text("potential"), // options "listing_potential"
    listingType: text("listing_type"), // options "listing_type"
    agentId: uuid("agent_id").references(() => users.id),
    zoneId: uuid("zone_id").references(() => zones.id),
    projectId: uuid("project_id").references(() => projects.id),

    listedAt: date("listed_at"), // original sheet creation date
    postedAt: date("posted_at"),
    closedAt: date("closed_at"),

    propertyType: text("property_type"), // options "property_type"
    inProject: boolean("in_project"),
    streetSoi: text("street_soi"),
    locationGrade: text("location_grade"), // options "location_grade"
    btsStationId: uuid("bts_station_id").references(() => transitStations.id),
    mrtStationId: uuid("mrt_station_id").references(() => transitStations.id),
    arlStationId: uuid("arl_station_id").references(() => transitStations.id),
    unitTypeName: text("unit_type_name"),
    unitNo: text("unit_no"),
    bed: smallint("bed"),
    bath: smallint("bath"),
    maidRoom: smallint("maid_room"),
    // land measures are numeric throughout — live data has fractional งาน
    // ("5.5" on HBH-SI-96), and fractional ไร่ is common notation too
    landRai: numeric("land_rai", { precision: 8, scale: 2 }),
    landNgan: numeric("land_ngan", { precision: 8, scale: 2 }),
    landWa: numeric("land_wa", { precision: 8, scale: 2 }),
    usableSqm: numeric("usable_sqm", { precision: 10, scale: 2 }),
    floor: text("floor"),
    building: text("building"),
    view: text("view"),
    direction: text("direction"), // options "direction"
    position: text("position"), // options "unit_position"
    parking: text("parking"),
    unitCondition: text("unit_condition"), // options "unit_condition"

    askingPrice: numeric("asking_price", { precision: 14, scale: 2 }),
    rentalPrice: numeric("rental_price", { precision: 12, scale: 2 }),
    priceRemark: text("price_remark"), // options "price_remark"

    ownerId: uuid("owner_id").references(() => contacts.id),
    ownerTalkCount: integer("owner_talk_count").notNull().default(0),
    lastFollowedAt: date("last_followed_at"),

    postRemark: text("post_remark"),
    remarkCream: text("remark_cream"),
    googleMapsLink: text("google_maps_link"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("listings_agent_idx").on(t.agentId),
    index("listings_zone_idx").on(t.zoneId),
    index("listings_status_idx").on(t.status),
    index("listings_project_idx").on(t.projectId),
    index("listings_owner_idx").on(t.ownerId),
  ]
);

// R2-backed media; replaces the four Drive-folder link columns.
export const listingMedia = pgTable(
  "listing_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    kind: mediaKind("kind").notNull(),
    r2Key: text("r2_key").notNull(),
    sourceDriveUrl: text("source_drive_url"), // import provenance
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("listing_media_listing_idx").on(t.listingId)]
);

// Per-portal marketing state (DD/LV/PH/FB).
export const listingChannels = pgTable(
  "listing_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // options "listing_channel"
    url: text("url"),
    boosted: boolean("boosted").notNull().default(false),
    lastPushedAt: date("last_pushed_at"), // วันที่ดันล่าสุด
    marketingReportLink: text("marketing_report_link"),
    facebookAdDoc: text("facebook_ad_doc"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("listing_channels_listing_channel_idx").on(
      t.listingId,
      t.channel
    ),
  ]
);

// Audit/change-request log (Listing Update tabs + Support Sheet Update Form).
export const listingUpdates = pgTable(
  "listing_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    columnName: text("column_name"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    status: listingUpdateStatus("status").notNull().default("pending"),
    requestedBy: uuid("requested_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("listing_updates_listing_idx").on(t.listingId),
    index("listing_updates_status_idx").on(t.status),
  ]
);

/* ── portal repost machinery (ported from Klaichan/Mook) ─────────────── */

/** Repost cadence: one row per (grade × channel) that has a reminder.
    The CADENCE IS THE SWITCH — filling a cell puts every listing already
    posted on that channel on schedule; no row = never due. The queue is
    ARITHMETIC over this + listing_channels.last_pushed_at: ticking ดันแล้ว
    moves the anchor and the row disappears until due again. Nothing to
    reset, nothing that can drift. */
export const repostRules = pgTable(
  "repost_rules",
  {
    id: serial("id").primaryKey(),
    gradeKey: text("grade_key").notNull(), // options "listing_potential"
    channelKey: text("channel_key").notNull(), // options "listing_channel"
    days: integer("days").notNull(),
  },
  (t) => [uniqueIndex("repost_rules_pair_idx").on(t.gradeKey, t.channelKey)]
);

/** Append-only log of ดันแล้ว ticks — the KPI view of reposting work.
    Deliberately no FK cascade wipe-outs beyond the listing itself. */
export const portalPushes = pgTable(
  "portal_pushes",
  {
    id: serial("id").primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // options "listing_channel"
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    by: uuid("by").references(() => users.id),
  },
  (t) => [index("portal_pushes_listing_idx").on(t.listingId)]
);

/** Post-template overrides (Settings → เทมเพลตโพสต์). Only edited combos
    get a row; "คืนค่าเริ่มต้น" deletes it and the code defaults
    (lib/copy-templates.ts) apply again. */
export const copyTemplates = pgTable(
  "copy_templates",
  {
    listingType: text("listing_type").notNull(), // options "listing_type"
    tier: text("tier").$type<"high" | "low">().notNull(),
    headline: text("headline").notNull().default(""),
    normal: text("normal").notNull().default(""),
    dd: text("dd").notNull().default(""),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.listingType, t.tier] })]
);

/* โฟกัสเจ้าของ — the listings one agent is actively working (0029).

   THE PROBLEM IT SOLVES. An agent's book is 200-400 listings (Holah 424, Do
   353, Stang 309 at the time of writing) and the set they are actually pushing
   this month is 30-40. There was no way to say which, so "my listings" was a
   haystack and the working set lived in someone's head or a private
   spreadsheet.

   ON THE LISTING, SHOWN BY OWNER (Ben, 2026-09-11). The star attaches to a
   listing, because that is the row you are looking at when you decide. The
   /owner-focus page then GROUPS by owner, because the follow-up is a conversation
   with a person, not with a unit — and 86% of owners hold exactly one listing
   (1,159 of 1,342), so for almost everyone the two readings coincide anyway.
   Starring the owner instead would have bought that last 14% at the cost of a
   second thing to learn.

   PER USER, NOT PER LISTING. Two agents can work the same building from
   different angles, and a co-broke must not silently unfocus someone else's
   work. The composite key is the whole table — this is user_zones' shape, and
   for the same reason: a membership, not a record.

   NOT `potential`. That column grades the PROPERTY (A/B/C/Exclusive) and is
   shared team data; this is one person's attention this month and changes
   weekly. Overloading the grade to mean "I'm working on it" would have
   destroyed the only field that answers "is this a good listing". */
export const listingFocus = pgTable(
  "listing_focus",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    /** When it was starred — the focus board sorts oldest-first, so a listing
        that has sat starred and untouched for weeks rises rather than sinks. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.listingId] }),
    // The PK serves "what do I focus"; this serves the other direction —
    // "who focuses this listing", which the drawer asks on every open.
    index("listing_focus_listing_idx").on(t.listingId),
  ]
);
