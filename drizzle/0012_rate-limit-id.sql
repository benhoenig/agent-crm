-- 0012_rate-limit-id — rate_limits.id: text → uuid with a DB default.
--
-- Better Auth (generateId: "uuid") expects the database to mint ids; the
-- text PK without a default made every rate-limit insert fail, which 500'd
-- every password sign-in since the limiter shipped. The table only ever
-- holds ephemeral throttle counters (and no insert ever succeeded), so it
-- is emptied rather than migrated.
TRUNCATE "rate_limits";--> statement-breakpoint
ALTER TABLE "rate_limits" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();--> statement-breakpoint
ALTER TABLE "rate_limits" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
