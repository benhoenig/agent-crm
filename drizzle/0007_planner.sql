CREATE TABLE "plan_dayoffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_prefs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_recaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"good" text,
	"lesson" text,
	"tomorrow" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_recurring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"kind" text,
	"freq" text DEFAULT 'daily' NOT NULL,
	"weekdays" text,
	"day_of_month" integer,
	"start_date" date,
	"start_time" text,
	"end_time" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ALTER COLUMN "date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ALTER COLUMN "start_time" SET DATA TYPE text USING to_char("start_time", 'HH24:MI');--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ADD COLUMN "recurring_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ADD COLUMN "end_time" text;--> statement-breakpoint
ALTER TABLE "plan_dayoffs" ADD CONSTRAINT "plan_dayoffs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_prefs" ADD CONSTRAINT "plan_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_recaps" ADD CONSTRAINT "plan_recaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_recurring" ADD CONSTRAINT "plan_recurring_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_dayoffs_user_date_idx" ON "plan_dayoffs" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_recaps_user_date_idx" ON "plan_recaps" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "plan_recurring_user_idx" ON "plan_recurring" USING btree ("user_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_plan_tasks_recurring_day_idx" ON "daily_plan_tasks" USING btree ("recurring_id","date") WHERE "daily_plan_tasks"."recurring_id" is not null;--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","sort_order","system") VALUES ('task_type','สร้างยอด','accent',0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","sort_order","system") VALUES ('task_type','งานประจำ','info',10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","sort_order","system") VALUES ('task_type','ส่วนตัว','muted',20,false);
