-- Last Match stops being open to everyone (Ben, 2026-09-11: "habihub last
-- match -> ให้แค่ทีม leader เห็น", leader = ผู้จัดการ).
--
-- The page carried own / ทีม / ทั้งหมด buttons that were a user PREFERENCE
-- with no permission behind them — lib/repo/lastmatch.ts said so outright:
-- "applied on top of nothing else: the log is meant to be shared intel". So
-- every agent could read every closed price and buyer persona in the company,
-- which is the most portable data this database holds.
--
-- "own" AND NOT false. Sales still enter these — 24 of the first 40 rows are
-- theirs — and a role that can write into a list it can never read back is a
-- role that stops writing. They keep their own entries; the company's book is
-- what is withheld.
--
-- EVERY ROW IS NAMED, for the reason 0028 spells out: parsePerms degrades a
-- missing field to the SALES value, and here sales is "own" — so leaving a
-- role unset does not leave it at its matrix default, it silently restricts
-- it. Right way round for safety, wrong way round for a blanket UPDATE.
UPDATE "roles" SET "perms" = "perms" || '{"lastMatch": "all"}'::jsonb WHERE "id" = 'superadmin';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"lastMatch": "all"}'::jsonb WHERE "id" = 'manager';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"lastMatch": "own"}'::jsonb WHERE "id" = 'sales';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"lastMatch": "own"}'::jsonb WHERE "id" = 'admin_support';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"lastMatch": "own"}'::jsonb WHERE "id" = 'listing_support';

-- Custom roles added in Settings are left alone deliberately: they fall
-- through parsePerms to "own", which is the restrictive answer, and the select
-- is now in the roles editor for whoever owns that role to widen.
