-- The access log for market intelligence (Ben, 2026-09-11: "it's valuable data
-- that we want to see who's been looking at it and have weird behaviors").
--
-- THE ONLY TABLE HERE THAT RECORDS A READ. Every other log in this schema —
-- listing_updates, actions, notifications — records a CHANGE, which has an
-- author who meant it. A read log is a heavier instrument, so it covers two
-- surfaces and no more: the โครงการ surveys and Last Match. See
-- lib/db/schema/activity.ts recordViews for the full reasoning.
--
-- NO "ON DELETE cascade" ON user_id, and it is the one table in this schema
-- that leaves it off on purpose: an audit trail that erases itself the moment
-- the person under suspicion is deleted is not an audit trail. Departing staff
-- are BANNED rather than deleted here, so nothing routine collides with it.
CREATE TABLE "record_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"record_id" uuid,
	"rows" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "record_views" ADD CONSTRAINT "record_views_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "record_views_user_idx" ON "record_views" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "record_views_record_idx" ON "record_views" USING btree ("entity","record_id","created_at");--> statement-breakpoint

-- viewAudit — may READ the log above (/view-audit).
--
-- Its own flag because no existing one fits: the two people who investigate
-- "is somebody copying our research" are ซูเปอร์แอดมิน and ผู้จัดการ, and those
-- two share no oversight permission — settings, teamManage and ledger are all
-- superadmin-only, and focusDirectory is about coaching. Reusing one would have
-- meant locking the manager out, or handing them the HR records to get in.
--
-- EVERY ROLE IS NAMED, for the reason 0028 spelled out and paid for: parsePerms
-- degrades a missing field to the SALES value, so leaving a role unset does not
-- leave it at its matrix default — it silently turns the permission OFF. Safe
-- direction, wrong one for a blanket UPDATE.
UPDATE "roles" SET "perms" = "perms" || '{"viewAudit": true}'::jsonb  WHERE "id" = 'superadmin';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"viewAudit": true}'::jsonb  WHERE "id" = 'manager';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"viewAudit": false}'::jsonb WHERE "id" = 'sales';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"viewAudit": false}'::jsonb WHERE "id" = 'admin_support';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"viewAudit": false}'::jsonb WHERE "id" = 'listing_support';

-- Custom roles added in Settings fall through parsePerms to false, which is the
-- restrictive answer, and the toggle is in the roles editor to turn on.
