-- Company-wide listing inventory (/inventory). Read-only browse of every
-- agent's stock; owner contact stays governed by "ownerContacts" and the
-- write path stays on listingScope(), so this grants visibility only.
UPDATE "roles" SET "perms" = "perms" || '{"listingDirectory": true}'::jsonb WHERE "system" = true;
