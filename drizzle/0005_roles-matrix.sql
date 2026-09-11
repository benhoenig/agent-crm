CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text,
	"count" integer,
	"last_request" bigint
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"perms" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text USING "role"::text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'sales';--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
INSERT INTO "roles" ("id","name","description","system","sort_order","perms") VALUES ('admin','แอดมิน','เห็นและจัดการได้ทุกอย่าง รวมข้อมูล PII และการตั้งค่า',true,0,'{"listings":"all","leads":"all","deals":"all","dealLegalPII":true,"ownerContacts":"all","listingUpdateQueue":true,"goals":"all","intakeAssign":true,"settings":true,"teamManage":true,"leaveApprove":true}'::jsonb);--> statement-breakpoint
INSERT INTO "roles" ("id","name","description","system","sort_order","perms") VALUES ('manager','ผู้จัดการ','เห็นทุกดีลและลูกค้า อนุมัติลาได้ แต่ไม่แตะการตั้งค่าระบบ',true,10,'{"listings":"all","leads":"all","deals":"all","dealLegalPII":false,"ownerContacts":"all","listingUpdateQueue":true,"goals":"all","intakeAssign":true,"settings":false,"teamManage":false,"leaveApprove":true}'::jsonb);--> statement-breakpoint
INSERT INTO "roles" ("id","name","description","system","sort_order","perms") VALUES ('sales','เซลส์','เห็นงานของตัวเองและโซนที่ได้รับมอบหมาย',true,20,'{"listings":"own+zone","leads":"own+zone","deals":"own","dealLegalPII":false,"ownerContacts":"own-listings","listingUpdateQueue":false,"goals":"own","intakeAssign":false,"settings":false,"teamManage":false,"leaveApprove":false}'::jsonb);--> statement-breakpoint
INSERT INTO "roles" ("id","name","description","system","sort_order","perms") VALUES ('support','ซัพพอร์ต','ดูแลข้อมูลประกาศและคิวแก้ไข ไม่เห็นดีล',true,30,'{"listings":"all","leads":"all","deals":"none","dealLegalPII":false,"ownerContacts":"all","listingUpdateQueue":true,"goals":"own","intakeAssign":true,"settings":false,"teamManage":false,"leaveApprove":false}'::jsonb);
