-- Opening a new lead becomes its own permission (Ben, 2026-09-11: "sales
-- should never be able to create leads").
--
-- It was read off the `leads` SCOPE, which is a different question. Sales
-- must keep leads:"own+zone" to work the book they are handed, and canCreate()
-- took that to mean they could also invent one. Intake is one desk: enquiries
-- arrive on the company's channels, admin support turns them into rows and
-- assigns them out. A lead typed by the agent who will own it skips the
-- duplicate check that desk performs and is never counted as an enquiry.
--
-- WHY EVERY ROW IS NAMED INSTEAD OF ONE `WHERE system = true`. parsePerms
-- degrades a missing field to the SALES value, and sales is the one role that
-- must be false here — so leaving a role unset does not leave it at its
-- matrix default, it silently turns the permission OFF. That is the right way
-- round for safety and the wrong way round for a blanket UPDATE: 0014 could
-- write one value to every system role because listingDirectory was true for
-- the fallback role too. This one cannot.
UPDATE "roles" SET "perms" = "perms" || '{"leadCreate": true}'::jsonb  WHERE "id" = 'superadmin';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"leadCreate": true}'::jsonb  WHERE "id" = 'manager';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"leadCreate": true}'::jsonb  WHERE "id" = 'admin_support';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"leadCreate": false}'::jsonb WHERE "id" = 'sales';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"leadCreate": false}'::jsonb WHERE "id" = 'listing_support';

-- Custom roles somebody added in Settings are deliberately left alone: they
-- fall through parsePerms to false, which is the restrictive answer, and the
-- toggle is now in the editor for whoever owns that role to turn on.
