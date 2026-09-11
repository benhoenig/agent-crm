-- One user, many roles (Ben, 2026-08-25).
--
-- Do and Stang run the team AND carry 300+ listings each — they are managers
-- and sales at once, and a single `users.role` column could not say so.
--
-- `users.role` is NOT dropped: Better Auth owns that column and puts it on the
-- session, and it stays the PRIMARY role for display. This table is the grant
-- set; the primary is always mirrored into it, so permission resolution reads
-- one place and merges most-permissively.
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk"
  FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Backfill: everyone keeps exactly what they have today. A user whose
-- users.role points at a role row that no longer exists is skipped rather than
-- failing the migration — permsForUser degrades those to the sales matrix.
INSERT INTO "user_roles" ("user_id","role_id")
SELECT u."id", u."role" FROM "users" u
WHERE EXISTS (SELECT 1 FROM "roles" r WHERE r."id" = u."role")
ON CONFLICT DO NOTHING;
