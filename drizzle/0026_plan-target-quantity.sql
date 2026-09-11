-- The plan absorbs the activity log's quantity (Ben, 2026-08-30).
--
-- กิจกรรมวันนี้ used to own a form with its own quantity and hours fields —
-- a second door into `actions` beside ticking a planned task. The form is
-- gone; adding to the plan is now the only route in, so the number it used
-- to collect has to live on the task.
--
-- A TARGET, NOT A RESULT. This is what you INTENDED when you planned the
-- work ("call 5 owners"). Ticking the task pre-fills the confirm box with it
-- and logs whatever you confirm, so `actions.quantity` stays a record of what
-- happened and this column stays a record of what was meant. They are allowed
-- to differ, and the difference is the point.
--
-- Nullable with no default: most tasks are not countable, and 0 would mean
-- "planned none", which is not the same as "no number applies".
ALTER TABLE "daily_plan_tasks" ADD COLUMN IF NOT EXISTS "target_quantity" integer;
--> statement-breakpoint

-- Copied onto every instance the rule materializes, exactly like
-- action_category above it — a daily "โทร 10 สาย" carries its 10.
ALTER TABLE "plan_recurring" ADD COLUMN IF NOT EXISTS "target_quantity" integer;
