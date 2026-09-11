-- employment_status becomes an editable picklist (lib/options/kinds.ts).
--
-- No schema change: users.employment_status is already a text column. What
-- changes is that the values become a catalog the client owns, so they can be
-- renamed to Thai, retoned, and extended (ทดลองงาน, พักงาน) without a deploy.
--
-- The seeded keys are the values the HR import ACTUALLY produced — "Active"
-- and "Inactive", English, in an otherwise Thai UI. Seeding a tidy Thai list
-- instead would have orphaned every existing user row. Renaming them in
-- Settings rewrites users.employment_status through the kind registry, which
-- is exactly what that machinery is for.
--
-- "Inactive" carries the `departed` role: Settings → บัญชีผู้ใช้ warns when a
-- row tagged with it still has a working login. That case exists in the data
-- today (one member is Inactive and not suspended).
INSERT INTO "options" ("kind","key","tone","role","sort_order","system")
  VALUES ('employment_status','Active','good',NULL,0,false)
  ON CONFLICT ("kind","key") DO NOTHING;--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system")
  VALUES ('employment_status','Inactive','muted','departed',10,false)
  ON CONFLICT ("kind","key") DO NOTHING;
