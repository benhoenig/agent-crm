-- Undo a logged activity (Ben, 2026-08-29: "there's no way to undo
-- บันทึกกิจกรรม on the dashboard page").
--
-- actions.task_id — WHICH PLAN TASK, IF ANY, WROTE THIS ROW.
--
-- The plan-is-the-log link (0019) has so far been implied and never stored:
-- ticking a task inserts an `actions` row and nothing connects the two
-- afterwards. That was survivable while the log was append-only. It is not
-- survivable now that a row can be removed, because deleting the activity
-- behind a ticked task would leave the task claiming work with no record of
-- it — the exact drift completeTask was written to prevent. With the link
-- stored, removing the activity un-ticks the task that wrote it, and the two
-- go back to agreeing.
--
-- ON DELETE SET NULL, not cascade: deleting a plan task must never delete the
-- work it recorded. The activity happened; only the note-to-self is gone.
-- NULL is also every historic row and every hand-logged one, and both read
-- correctly as "no task behind this".

ALTER TABLE "actions" ADD COLUMN "task_id" uuid;--> statement-breakpoint

ALTER TABLE "actions" ADD CONSTRAINT "actions_task_id_daily_plan_tasks_id_fk"
  FOREIGN KEY ("task_id") REFERENCES "public"."daily_plan_tasks"("id")
  ON DELETE set null ON UPDATE no action;
