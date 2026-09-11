-- Nobody in the company could set a target. Repairing that, and widening it by
-- one role (Ben, 2026-09-11: "manager and superadmin should be able to set the
-- target right?" → "yeah go B").
--
-- WHAT WAS BROKEN. `targetsSet` was added to the code on 2026-08-29 and never
-- written into the existing `roles` rows. parsePerms degrades a missing field
-- to the SALES value — false — so ผู้จัดการ, the one role the permission was
-- created for, silently had it off in production for three weeks: no revenue
-- targets, no KPI targets, and no ทีมของฉัน on their dashboard. Development had
-- the key on all five rows, which is why it never showed up locally.
--
-- Only แอดมินซัพพอร์ต carried the key at all, and that is the tell: somebody
-- edited that role in Settings, and the old read-modify-write updateRolePerms
-- rewrote its whole key set as a side effect. The same mechanism that hid this
-- bug is the one fixed in 84f2941.
--
-- SUPERADMIN GOES TRUE, reversing 2026-08-29. The old reasoning — the manager
-- owns what the team is measured on, and a duty with two owners has none — is
-- still right about the job. It was wrong about the lock: every other exclusion
-- on that row has "hold the other role" as its break-glass, and this one did
-- not, because the fallback role was broken by the very same gap. Three weeks
-- of nobody being able to set a target, unfixable from inside the app, is the
-- argument.
--
-- EVERY ROLE IS NAMED, for the reason 0028 spelled out and this migration is
-- the bill for: a role left unset does not keep its matrix default, it silently
-- takes the sales value.
UPDATE "roles" SET "perms" = "perms" || '{"targetsSet": true}'::jsonb  WHERE "id" = 'superadmin';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"targetsSet": true}'::jsonb  WHERE "id" = 'manager';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"targetsSet": false}'::jsonb WHERE "id" = 'sales';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"targetsSet": false}'::jsonb WHERE "id" = 'admin_support';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"targetsSet": false}'::jsonb WHERE "id" = 'listing_support';
