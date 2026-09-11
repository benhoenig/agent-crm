-- The reporting line, and who owns a sales agent's numbers (Ben, 2026-08-29).
--
-- users.manager_id — WHICH MANAGER A SALES AGENT SITS UNDER.
--
-- NOT `users.team`, which already exists. That column is free text ("ทีม A"),
-- null for every row, and names a group rather than a person — so nothing can
-- get from it to a manager without a second lookup table mapping team names to
-- people. A self-referencing FK says the thing directly and cannot drift out
-- of step with the person it names: rename a team and the line survives;
-- deactivate a manager and the FK is still resolvable.
--
-- ON DELETE SET NULL, not cascade: losing a manager must never delete the
-- people who reported to them. An unassigned agent is a gap someone fixes,
-- which is exactly what it should look like.

ALTER TABLE "users" ADD COLUMN "manager_id" uuid;--> statement-breakpoint

ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_users_id_fk"
  FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "users_manager_idx" ON "users" USING btree ("manager_id");
