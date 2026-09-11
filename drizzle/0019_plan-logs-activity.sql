-- The daily plan becomes the activity log (Ben, 2026-08-28).
--
-- One column. A plan task may now name the ACTION CATEGORY it represents, and
-- ticking it writes the `actions` row the scoreboard counts — the same
-- contract ติดตามวันนี้ already had for lead/listing-linked tasks, generalised
-- to any task.
--
-- WHY A CATEGORY ON THE TASK AND NOT A REUSE OF `kind`. `daily_plan_tasks.kind`
-- is a `task_type` option: it colours the row and the ratio bar, and it is the
-- planner's own vocabulary ("โทร", "เอกสาร"). `action_category` is the
-- SCOREBOARD's vocabulary — the same picklist ความเคลื่อนไหว, the KPI columns
-- and the activity matrix are all indexed by. They are edited in Settings as
-- two separate lists by people who do not know the other exists, so making one
-- stand in for the other would mean a rename in one place silently stopping a
-- number somewhere else. Migration 0018 refused the same shortcut between
-- action categories and pipeline stages, for the same reason.
--
-- NULLABLE, and most tasks will keep it null: "จัดโต๊ะ" is a real task and no
-- kind of sales activity. A task with no category ticks like it always did.
--
-- No backfill. Tasks completed before today were never logged as activity and
-- inventing rows for them would put numbers on the scoreboard nobody earned.

ALTER TABLE "daily_plan_tasks" ADD COLUMN "action_category" text;
--> statement-breakpoint

-- A REPEATING task carries the category too, or a rule like "โทรหาลูกค้า
-- 10 ราย ทุกวัน" would lose it on materialization and quietly stop counting.
-- Instances copy it the same way they copy `kind`; changing a rule does not
-- rewrite the days it already produced.
ALTER TABLE "plan_recurring" ADD COLUMN "action_category" text;
