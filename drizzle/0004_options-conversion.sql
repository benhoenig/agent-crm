CREATE TABLE "options" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"tone" text,
	"role" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_personas" DROP CONSTRAINT "project_personas_trust_trigger_check";--> statement-breakpoint
ALTER TABLE "listing_channels" ALTER COLUMN "channel" SET DATA TYPE text USING "channel"::text;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "status" SET DEFAULT 'ข้อมูลยังไม่ครบ';--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "potential" SET DATA TYPE text USING "potential"::text;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "listing_type" SET DATA TYPE text USING "listing_type"::text;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "property_type" SET DATA TYPE text USING "property_type"::text;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "location_grade" SET DATA TYPE text USING "location_grade"::text;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "direction" SET DATA TYPE text USING "direction"::text;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "position" SET DATA TYPE text USING "position"::text;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "unit_condition" SET DATA TYPE text USING "unit_condition"::text;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "price_remark" SET DATA TYPE text USING "price_remark"::text;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "closing_status" SET DATA TYPE text USING "closing_status"::text;--> statement-breakpoint
ALTER TABLE "last_matches" ALTER COLUMN "type" SET DATA TYPE text USING "type"::text;--> statement-breakpoint
ALTER TABLE "last_matches" ALTER COLUMN "potential" SET DATA TYPE text USING "potential"::text;--> statement-breakpoint
ALTER TABLE "last_matches" ALTER COLUMN "property_type" SET DATA TYPE text USING "property_type"::text;--> statement-breakpoint
ALTER TABLE "last_matches" ALTER COLUMN "direction" SET DATA TYPE text USING "direction"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "lead_type" SET DATA TYPE text USING "lead_type"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "source" SET DATA TYPE text USING "source"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "contact_by" SET DATA TYPE text USING "contact_by"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "potential" SET DATA TYPE text USING "potential"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "lead_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "lead_status" SET DATA TYPE text USING "lead_status"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "lead_status" SET DEFAULT 'Active';--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "complain_severity" SET DATA TYPE text USING "complain_severity"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "complain_status" SET DATA TYPE text USING "complain_status"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "case_status" SET DATA TYPE text USING "case_status"::text;--> statement-breakpoint
ALTER TABLE "actions" ALTER COLUMN "category" SET DATA TYPE text USING "category"::text;--> statement-breakpoint
CREATE UNIQUE INDEX "options_kind_key_idx" ON "options" USING btree ("kind","key");--> statement-breakpoint
CREATE INDEX "options_kind_sort_idx" ON "options" USING btree ("kind","sort_order");--> statement-breakpoint
DROP TYPE "public"."action_category";--> statement-breakpoint
DROP TYPE "public"."buyer_potential";--> statement-breakpoint
DROP TYPE "public"."case_status";--> statement-breakpoint
DROP TYPE "public"."closing_status";--> statement-breakpoint
DROP TYPE "public"."complain_severity";--> statement-breakpoint
DROP TYPE "public"."complain_status";--> statement-breakpoint
DROP TYPE "public"."contact_by";--> statement-breakpoint
DROP TYPE "public"."direction";--> statement-breakpoint
DROP TYPE "public"."last_match_type";--> statement-breakpoint
DROP TYPE "public"."lead_status";--> statement-breakpoint
DROP TYPE "public"."lead_type";--> statement-breakpoint
DROP TYPE "public"."listing_channel_name";--> statement-breakpoint
DROP TYPE "public"."listing_status";--> statement-breakpoint
DROP TYPE "public"."listing_type";--> statement-breakpoint
DROP TYPE "public"."location_grade";--> statement-breakpoint
DROP TYPE "public"."marketing_channel";--> statement-breakpoint
DROP TYPE "public"."potential";--> statement-breakpoint
DROP TYPE "public"."price_remark";--> statement-breakpoint
DROP TYPE "public"."property_type";--> statement-breakpoint
DROP TYPE "public"."unit_condition";--> statement-breakpoint
DROP TYPE "public"."unit_position";--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','โพสต์แล้ว','good','posted',0,true);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','ข้อมูลครบ รอโพสต์','info','preparing',10,true);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','ข้อมูลยังไม่ครบ','warn','preparing',20,true);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','Update ข้อมูล','warn','preparing',30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','เอาประกาศลงชั่วคราว','muted','paused',40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','เอาประกาศลงชั่วคราว ✅','muted','paused',50,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','แคนเซิลประกาศ','bad','withdrawn',60,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','แคนเซิลประกาศ ✅','bad','withdrawn',70,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','เช่าแล้ว ✅','accent','closed_won',80,true);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','ขายแล้ว ✅','accent','closed_won',90,true);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','Reserved','info',NULL,100,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','เช่าแล้วเอเจ้นอื่น ✅','muted','closed_other',110,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_status','ขายแล้วเอเจ้นอื่น ✅','muted','closed_other',120,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_type','Sale',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_type','Rent',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_type','Sale & Rent',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_type','Sale with Tenant',NULL,NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_type','Co-Agent',NULL,NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_potential','A','accent',NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_potential','B','info',NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_potential','C','muted',NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_potential','Exclusive','good',NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_potential','A','accent',NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_potential','B','info',NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_potential','C','muted',NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_potential','New Lead','warn',NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','บ้านเดี่ยว',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','บ้านแฝด',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','ทาวน์เฮ้าส์',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','ทาวน์โฮม',NULL,NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','คอนโด',NULL,NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','ที่ดิน',NULL,NULL,50,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','อพาร์ทเม้นท์',NULL,NULL,60,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','โรงแรม',NULL,NULL,70,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','ออฟฟิศ',NULL,NULL,80,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','โกดัง',NULL,NULL,90,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','โรงงาน',NULL,NULL,100,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('property_type','อาคารพาณิชย์',NULL,NULL,110,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('direction','North',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('direction','South',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('direction','East',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('direction','West',NULL,NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('direction','Northeast',NULL,NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('direction','Northwest',NULL,NULL,50,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('direction','Southeast',NULL,NULL,60,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('direction','Southwest',NULL,NULL,70,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_position','มุม',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_position','ริม',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_position','หน้าบ้าน/หน้าสวน',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_position','หน้าบ้านไม่ชนใคร',NULL,NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_position','ปกติ',NULL,NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_position','ไม่ใกล้ลิฟต์',NULL,NULL,50,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_position','ไม่ใกล้ห้องขยะ',NULL,NULL,60,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_position','วิวโล่ง/วิวสวน',NULL,NULL,70,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_position','หน้าห้องไม่ชนใคร',NULL,NULL,80,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('price_remark','50/50 Transfer Fee',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('price_remark','All Included',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('price_remark','All Tax Not Included',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_condition','Great','good',NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_condition','Good','info',NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_condition','Bad','warn',NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('unit_condition','Broken','bad',NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('location_grade','A','accent',NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('location_grade','B','info',NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('location_grade','C','muted',NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_channel','Ddproperty',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_channel','Livinginsider',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_channel','PropertyHub',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_channel','FB Group',NULL,NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('listing_channel','FB Page',NULL,NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_type','Owner - Sale',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_type','Owner - Rent',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_type','Owner - Others',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_type','Buyer - Buy',NULL,NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_type','Buyer - Rent',NULL,NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_type','Co-Agent',NULL,NULL,50,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('marketing_channel','Ddproperty',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('marketing_channel','Livinginsider',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('marketing_channel','Propertyhub',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('marketing_channel','Facebook Organic',NULL,NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('marketing_channel','Facebook Ad',NULL,NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('marketing_channel','ป้าย Offline',NULL,NULL,50,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('marketing_channel','Referral',NULL,NULL,60,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('marketing_channel','อื่นๆ',NULL,NULL,70,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('contact_by','Call',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('contact_by','LINE OA',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('contact_by','Facebook Inbox',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('contact_by','Ddproperty Inbox',NULL,NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('contact_by','Livinginsider Inbox',NULL,NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('contact_by','Email',NULL,NULL,50,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('contact_by','Personal',NULL,NULL,60,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_status','Active','good','open',0,true);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_status','Lose','bad','lost',10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_status','Reject','bad','lost',20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_status','Sold','accent','won',30,true);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('lead_status','Cancel','muted',NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('case_status','Completed','good',NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('case_status','Failed','bad',NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('case_status','Cancel','muted',NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('case_status','Success!','accent',NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('complain_severity','Small','warn',NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('complain_severity','Serious','bad',NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('complain_severity','Critical','bad',NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('complain_status','In Progress','warn',NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('complain_status','Resolved','good',NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('complain_status','Failed','bad',NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('closing_status','Reserved','info',NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('closing_status','Sign Contract','info',NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('closing_status','Banking','warn',NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('closing_status','In Progress','info',NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('closing_status','EX','warn',NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('closing_status','Done','good',NULL,50,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('closing_status','Failed','bad','dead',60,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('closing_status','Com. Paid','accent','settled',70,true);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('last_match_type','ปิดเอง','accent',NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('last_match_type','คนอื่นปิด','info',NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('last_match_type','เจ้าของขายเอง','warn',NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('last_match_type','เอเจ้นอื่นขายไป','warn',NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('last_match_type','ไม่รู้','muted',NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','New List',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','Owner Visit',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','Owner Talk',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','Survey',NULL,NULL,30,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','Call',NULL,NULL,40,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','Follow',NULL,NULL,50,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','Appoint',NULL,NULL,60,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','Show',NULL,NULL,70,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','Nego',NULL,NULL,80,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','Close',NULL,NULL,90,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','โอนกรรมสิทธิ์',NULL,NULL,100,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','เปลี่ยนน้ำ,ไฟ',NULL,NULL,110,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','เปิดประเมิน',NULL,NULL,120,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','ประชุม',NULL,NULL,130,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','ทำงานหน้าคอม',NULL,NULL,140,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('action_category','อื่นๆ (ระบุ Remark)',NULL,NULL,150,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('trust_trigger','เชื่อจากข้อมูลรองรับ',NULL,NULL,0,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('trust_trigger','เชื่อจากความสัมพันธ์',NULL,NULL,10,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('trust_trigger','เชื่อจากภาพลักษณ์ที่ดูน่าเชื่อถือ',NULL,NULL,20,false);--> statement-breakpoint
INSERT INTO "options" ("kind","key","tone","role","sort_order","system") VALUES ('trust_trigger','เชื่อจาก Social Proof',NULL,NULL,30,false);
