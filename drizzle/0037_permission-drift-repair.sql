-- Production had been enforcing the opposite of three decisions for three
-- weeks (Ben, 2026-09-11, after a diff of lib/auth/roles.ts against the live
-- `roles` table).
--
-- WHAT DRIFTED, and every one of these was decided and written down in
-- ROLE_MATRIX and never migrated:
--
--   superadmin.listingUpdateQueue   false in code, TRUE in production
--   manager.listingUpdateQueue      false in code, TRUE in production
--   manager.intakeAssign            false in code, TRUE in production
--
-- So ซูเปอร์แอดมิน ×3 and ผู้จัดการ ×2 all carried ซัพพอร์ตประกาศ's work
-- queues, and both managers could hand out leads — the exact duplication the
-- 2026-08-25 desk split and the "a queue with two owners has none" rule exist
-- to prevent.
--
-- THE SAME MECHANISM AS 0034, POINTED THE OTHER WAY, which is the part worth
-- remembering. There, a key was MISSING from the row, parsePerms degraded it
-- to the sales value, and nobody in the company could set a target — drift in
-- the restrictive direction, which announces itself because something stops
-- working. Here the rows kept their ORIGINAL `true` from the pre-split seed
-- while the code moved to `false`. Drift in the permissive direction announces
-- nothing at all: everything keeps working, for more people than intended.
-- Only a diff finds it, which is why one now ships as `pnpm roles:audit`.
--
-- EVERY ROLE IS NAMED for both permissions, for the reason 0034 paid for: a
-- role left unset does not keep its matrix default, it silently takes the
-- SALES value on the next read. Writing false where false is already correct
-- costs one statement and removes the only way this can be wrong later.

-- มอบหมาย Lead — แอดมินซัพพอร์ต's desk alone (Ben, 2026-08-28).
UPDATE "roles" SET "perms" = "perms" || '{"intakeAssign": false}'::jsonb WHERE "id" = 'superadmin';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"intakeAssign": false}'::jsonb WHERE "id" = 'manager';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"intakeAssign": false}'::jsonb WHERE "id" = 'accounting';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"intakeAssign": false}'::jsonb WHERE "id" = 'sales';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"intakeAssign": true}'::jsonb  WHERE "id" = 'admin_support';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"intakeAssign": false}'::jsonb WHERE "id" = 'listing_support';
--> statement-breakpoint
-- งานซัพพอร์ตประกาศ + ดันประกาศ — ซัพพอร์ตประกาศ's queue alone (Ben, 2026-08-29).
UPDATE "roles" SET "perms" = "perms" || '{"listingUpdateQueue": false}'::jsonb WHERE "id" = 'superadmin';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"listingUpdateQueue": false}'::jsonb WHERE "id" = 'manager';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"listingUpdateQueue": false}'::jsonb WHERE "id" = 'accounting';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"listingUpdateQueue": false}'::jsonb WHERE "id" = 'sales';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"listingUpdateQueue": false}'::jsonb WHERE "id" = 'admin_support';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"listingUpdateQueue": true}'::jsonb  WHERE "id" = 'listing_support';
