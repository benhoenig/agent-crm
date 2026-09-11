CREATE TABLE "deal_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"role" text NOT NULL,
	"payee_name" text,
	"payee_user_id" uuid,
	"pct" double precision,
	"amount" numeric(12, 2),
	"paid" boolean DEFAULT false NOT NULL,
	"paid_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"direction" text NOT NULL,
	"amount_satang" bigint NOT NULL,
	"category" text,
	"deal_id" uuid,
	"listing_id" uuid,
	"origin" text DEFAULT 'manual' NOT NULL,
	"payout_role" text,
	"has_receipt" boolean DEFAULT false NOT NULL,
	"files_link" text,
	"remark" text,
	"is_annual" boolean DEFAULT false NOT NULL,
	"annual_months" integer DEFAULT 12 NOT NULL,
	"created_by" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "receive_date" date;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "options" ADD COLUMN "section" text;--> statement-breakpoint
ALTER TABLE "options" ADD COLUMN "linked_key" text;--> statement-breakpoint
ALTER TABLE "deal_payouts" ADD CONSTRAINT "deal_payouts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_payouts" ADD CONSTRAINT "deal_payouts_payee_user_id_users_id_fk" FOREIGN KEY ("payee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_payouts_deal_idx" ON "deal_payouts" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_deal_idx" ON "transactions" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_deal_revenue_idx" ON "transactions" USING btree ("deal_id") WHERE "transactions"."origin" = 'deal_revenue';--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_payout_idx" ON "transactions" USING btree ("deal_id","payout_role") WHERE "transactions"."origin" = 'deal_payout';--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('payout_role','เซลส์',NULL,NULL,NULL,'ส่วนแบ่งคอม เซลส์',0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('payout_role','Co-Agent',NULL,NULL,NULL,'ส่วนแบ่งคอม Co-Agent',10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('payout_role','ที่ปรึกษา',NULL,NULL,NULL,'ส่วนแบ่งคอมมิชชั่นอื่นๆ',20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('payout_role','อื่นๆ',NULL,NULL,NULL,'ส่วนแบ่งคอมมิชชั่นอื่นๆ',30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','ค่าคอมมิชชั่นรับ','accent','commission_income','revenue',NULL,0,true);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','รายได้อื่นๆ',NULL,NULL,'revenue',NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','ส่วนแบ่งคอม เซลส์',NULL,NULL,'cogs',NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','ส่วนแบ่งคอม Co-Agent',NULL,NULL,'cogs',NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','ส่วนแบ่งคอมมิชชั่นอื่นๆ',NULL,'commission_split','cogs',NULL,40,true);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','เงินเดือน',NULL,NULL,'fixed',NULL,50,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','ประกันสังคม',NULL,NULL,'fixed',NULL,60,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','ค่าเช่า/ออฟฟิศ',NULL,NULL,'fixed',NULL,70,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','ค่าโฆษณา Facebook',NULL,NULL,'variable',NULL,80,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','ค่าโฆษณาเว็บอสังหาฯ',NULL,NULL,'variable',NULL,90,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','ค่าดำเนินงานอื่นๆ',NULL,NULL,'variable',NULL,100,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','แบรนด์/ระบบ/เครื่องมือ',NULL,NULL,'growth',NULL,110,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","section","linked_key","sort_order","system") VALUES ('ledger_category','เงินทุน / เงินกู้เจ้าของ',NULL,NULL,'financing',NULL,120,false);--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"ledger": true, "dealReview": true}'::jsonb WHERE "id" = 'admin';--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"ledger": false, "dealReview": true}'::jsonb WHERE "id" = 'manager';--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"ledger": false, "dealReview": false}'::jsonb WHERE "id" IN ('sales','support');
