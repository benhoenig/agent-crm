-- Photos on the โครงการ survey (Ben, 2026-09-11: "survey database … ใส่รูปได้
-- + ปรับให้ format อ่านง่ายขึ้นเหมือนดูทรัพย์ใน website").
--
-- The surveys carry ~50 fields each — developer, common fee, best view, pros
-- and cons, earthquake checks — and not one picture of the building. A survey
-- you cannot see is a spreadsheet row about a place.
--
-- SEPARATE FROM listing_media on purpose. A listing photo is of one unit and
-- dies with that listing; a project photo is of the lobby and the view, and
-- outlives every listing in the building. One table for both would have needed
-- a nullable listing_id AND a nullable project_id with a check constraint
-- keeping exactly one set — two tables wearing a trench coat.
--
-- uploaded_by DOES NOT CASCADE: losing who took the photo when someone leaves
-- would quietly turn attributed survey work anonymous. The photo stays, the
-- name goes null, which is the honest record.
CREATE TABLE "project_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_uploaded_by_users_id_fk"
  FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_media_project_idx" ON "project_media" USING btree ("project_id","sort_order");
