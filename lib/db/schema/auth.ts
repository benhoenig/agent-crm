import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { zones } from "./master";

// Better Auth core columns (id/name/email/emailVerified/image/createdAt/
// updatedAt) + the HR "Employee Lists" profile. Property keys must match
// Better Auth's camelCase field names — column names stay snake_case.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // display name (nickname preferred)
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("avatar_url"),
  role: text("role").notNull().default("sales"), // roles.id — matrix lives in the roles table
  lineUserId: text("line_user_id").unique(),

  // Better Auth admin plugin (ban = "deactivated" for departed employees;
  // a banned user cannot sign in and existing sessions are revoked).
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),

  // HR Employee Lists profile
  employeeCode: text("employee_code").unique(),
  employmentStatus: text("employment_status"),
  division: text("division"),
  position: text("position"),
  secondPosition: text("second_position"),
  team: text("team"),
  nameEng: text("name_eng"),
  nameThai: text("name_thai"),
  nickname: text("nickname"),
  /** Which manager this person sits under (0021). Self-referencing and
      nullable: not everyone reports to a manager, and an agent between
      managers is a gap someone fixes rather than a broken row.

      Deliberately NOT `team` above, which is free text naming a GROUP — a
      name cannot be resolved to a person without a second table, and renaming
      a team would silently break the line. Set at /team/[id]/edit by whoever
      holds teamManage. */
  managerId: uuid("manager_id"),
  gender: text("gender"),
  nationality: text("nationality"),
  phone: text("phone"),
  phone2: text("phone2"),
  idCardNo: text("id_card_no"), // PII — admin-scoped in the query layer
  address: text("address"),
  workEmail: text("work_email"),
  birthday: date("birthday"),
  dateStarted: date("date_started"),
  agreementFiles: jsonb("agreement_files").$type<string[]>(),
  emergencyContacts:
    jsonb("emergency_contacts").$type<
      { name: string; phone: string; relation: string }[]
    >(),
  remark: text("remark"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  // Better Auth admin plugin (impersonation is unused, but the column is
  // part of the plugin's session schema).
  impersonatedBy: uuid("impersonated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Agents own multiple zones; zones transfer between agents.
export const userZones = pgTable(
  "user_zones",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.zoneId] })]
);

// Editable permission matrix (Settings → สิทธิ์การใช้งาน). The four seed
// roles are `system` (undeletable; "admin" is also unmodifiable so the matrix
// can never lock every admin out). perms holds a RolePermissions object
// (lib/auth/roles.ts) — parsed and validated by parsePerms() on every read,
// falling back to the code seed on malformed data, so a bad row degrades to
// the shipped defaults rather than granting anything.
export const roles = pgTable("roles", {
  id: text("id").primaryKey(), // slug ("admin") or generated for custom roles
  name: text("name").notNull(), // display name, client-editable
  description: text("description").notNull().default(""),
  system: boolean("system").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  perms: jsonb("perms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Better Auth rate limiting, storage: "database" — the Workers runtime has no
// process-lifetime memory, so counters must live here for login throttling
// to hold across isolates.
export const rateLimits = pgTable("rate_limits", {
  // uuid + DB default like every other auth table: with generateId "uuid"
  // Better Auth expects the DATABASE to mint ids (it skips app-side
  // generation when the adapter supports UUIDs). text-without-default made
  // every rate-limit insert — and therefore every password sign-in — 500.
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key"),
  count: integer("count"),
  lastRequest: bigint("last_request", { mode: "number" }),
});

// A user's FULL role grant (Ben, 2026-08-25: "1 user can be multiple roles" —
// Do and Stang run a team AND carry 300+ listings each).
//
// `users.role` stays as the PRIMARY role: Better Auth owns that column and
// writes it on the session, and it is what the team pill shows. This table is
// the grant set, and the primary is always mirrored into it.
//
// Holding several roles does NOT mean working under all of them at once
// (2026-08-28). The grant set is the menu of positions someone may work as;
// which one is in effect is a per-request choice — lib/auth/position.ts.
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Deleting a role reassigns its users first (settings/roles/actions.ts),
    // so cascade here is a backstop, not the normal path.
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })]
);
