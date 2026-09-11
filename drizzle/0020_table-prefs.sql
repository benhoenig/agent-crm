-- Per-person column layout for the Sheets-style grids (Ben, 2026-08-28).
--
-- One row per person per grid. `table_key` is free text validated in code
-- against lib/tables/index.ts TABLE_KEYS, so making another table
-- configurable is a registry entry rather than a migration.
--
-- Both arrays are ADVISORY: the column registry in code is the authority on
-- which columns exist, and `resolve` filters a stored order through it on
-- every read. A column retired in a release therefore vanishes from a stale
-- saved order instead of rendering as a blank strip, and a column added in a
-- release shows up rather than staying invisible to everyone who ever opened
-- the manager.

CREATE TABLE "table_prefs" (
	"user_id" uuid NOT NULL,
	"table_key" text NOT NULL,
	"column_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hidden" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_prefs_user_id_table_key_pk" PRIMARY KEY("user_id","table_key")
);--> statement-breakpoint

ALTER TABLE "table_prefs" ADD CONSTRAINT "table_prefs_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
