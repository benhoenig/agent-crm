-- โฟกัส: the listings an agent is actively working (Ben, 2026-09-11: "maybe
-- to be able to favorite the list that the sales wants to focus... right now
-- they see their whole listings portfolio which might be 200-300 lists per
-- sales.. but the one they're focusing might be 30-40").
--
-- See lib/db/schema/property.ts listingFocus for why the star sits on the
-- LISTING while /focus groups by OWNER, and why this is not `potential`.
CREATE TABLE "listing_focus" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_focus_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);--> statement-breakpoint
ALTER TABLE "listing_focus" ADD CONSTRAINT "listing_focus_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_focus" ADD CONSTRAINT "listing_focus_listing_id_listings_id_fk"
  FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_focus_listing_idx" ON "listing_focus" USING btree ("listing_id");--> statement-breakpoint

-- focusDirectory — may read ANOTHER agent's focus list. Everyone always keeps
-- their own, so this only ever grants the manager's read.
--
-- EVERY ROLE IS NAMED, for the reason 0028 spelled out and paid for: parsePerms
-- degrades a missing field to the SALES value, so leaving a role unset does not
-- leave it at its matrix default — it silently turns the permission OFF. That
-- is the safe direction and the wrong one for a blanket UPDATE.
UPDATE "roles" SET "perms" = "perms" || '{"focusDirectory": true}'::jsonb  WHERE "id" = 'superadmin';--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"focusDirectory": true}'::jsonb  WHERE "id" = 'manager';--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"focusDirectory": false}'::jsonb WHERE "id" = 'admin_support';--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"focusDirectory": false}'::jsonb WHERE "id" = 'sales';--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"focusDirectory": false}'::jsonb WHERE "id" = 'listing_support';
