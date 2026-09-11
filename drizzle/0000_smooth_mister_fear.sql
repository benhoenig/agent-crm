CREATE TYPE "public"."action_category" AS ENUM('New List', 'Owner Visit', 'Owner Talk', 'Survey', 'Call', 'Follow', 'Appoint', 'Show', 'Nego', 'Close', 'โอนกรรมสิทธิ์', 'เปลี่ยนน้ำ,ไฟ', 'เปิดประเมิน', 'ประชุม', 'ทำงานหน้าคอม', 'อื่นๆ (ระบุ Remark)');--> statement-breakpoint
CREATE TYPE "public"."buyer_potential" AS ENUM('A', 'B', 'C', 'New Lead');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('Completed', 'Failed', 'Cancel', 'Success!');--> statement-breakpoint
CREATE TYPE "public"."closing_status" AS ENUM('Reserved', 'Sign Contract', 'Banking', 'EX', 'Done', 'Com. Paid');--> statement-breakpoint
CREATE TYPE "public"."complain_severity" AS ENUM('Small', 'Serious', 'Critical');--> statement-breakpoint
CREATE TYPE "public"."complain_status" AS ENUM('In Progress', 'Resolved', 'Failed');--> statement-breakpoint
CREATE TYPE "public"."contact_by" AS ENUM('Call', 'LINE OA', 'Facebook Inbox', 'Ddproperty Inbox', 'Livinginsider Inbox', 'Email', 'Personal');--> statement-breakpoint
CREATE TYPE "public"."deal_doc_type" AS ENUM('closed_case_file', 'receipt', 'spa', 'agent_agreement', 'other');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('North', 'South', 'East', 'West', 'Northeast', 'Northwest', 'Southeast', 'Southwest');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('Planned', 'In Progress', 'Success!', 'Failed', 'Cancel');--> statement-breakpoint
CREATE TYPE "public"."last_match_type" AS ENUM('ปิดเอง', 'คนอื่นปิด', 'เจ้าของขายเอง', 'เอเจ้นอื่นขายไป', 'ไม่รู้');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('Active', 'Lose', 'Reject', 'Sold', 'Cancel');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('Owner - Sale', 'Owner - Rent', 'Owner - Others', 'Buyer - Buy', 'Buyer - Rent', 'Co-Agent');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('sick', 'personal', 'vacation', 'other');--> statement-breakpoint
CREATE TYPE "public"."listing_channel_name" AS ENUM('Ddproperty', 'Livinginsider', 'PropertyHub', 'FB Group', 'FB Page');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('โพสต์แล้ว', 'ข้อมูลครบ รอโพสต์', 'ข้อมูลยังไม่ครบ', 'Update ข้อมูล', 'เอาประกาศลงชั่วคราว', 'เอาประกาศลงชั่วคราว ✅', 'แคนเซิลประกาศ', 'แคนเซิลประกาศ ✅', 'เช่าแล้ว ✅', 'ขายแล้ว ✅', 'Reserved', 'เช่าแล้วเอเจ้นอื่น ✅', 'ขายแล้วเอเจ้นอื่น ✅');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('Sale', 'Rent', 'Sale & Rent', 'Sale with Tenant', 'Co-Agent');--> statement-breakpoint
CREATE TYPE "public"."listing_update_status" AS ENUM('pending', 'approved', 'rejected', 'applied');--> statement-breakpoint
CREATE TYPE "public"."location_grade" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."marketing_channel" AS ENUM('Ddproperty', 'Livinginsider', 'Facebook Organic', 'Facebook Ad', 'ป้าย Offline', 'Referral', 'อื่นๆ');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('original', 'new_photo', 'shorts_reel', 'hometour');--> statement-breakpoint
CREATE TYPE "public"."pipeline_stage" AS ENUM('Lead', 'Call', 'Follow', 'Appoint', 'Show', 'Nego', 'Close', 'Win');--> statement-breakpoint
CREATE TYPE "public"."potential" AS ENUM('A', 'B', 'C', 'Exclusive');--> statement-breakpoint
CREATE TYPE "public"."price_remark" AS ENUM('50/50 Transfer Fee', 'All Included', 'All Tax Not Included');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('บ้านเดี่ยว', 'บ้านแฝด', 'ทาวน์เฮ้าส์', 'ทาวน์โฮม', 'คอนโด', 'ที่ดิน', 'อพาร์ทเม้นท์', 'โรงแรม', 'ออฟฟิศ', 'โกดัง', 'โรงงาน', 'อาคารพาณิชย์');--> statement-breakpoint
CREATE TYPE "public"."recap" AS ENUM('Work', 'Not Work');--> statement-breakpoint
CREATE TYPE "public"."sla_entity" AS ENUM('listing_follow', 'listing_post', 'lead_follow');--> statement-breakpoint
CREATE TYPE "public"."station_type" AS ENUM('BTS', 'MRT', 'ARL');--> statement-breakpoint
CREATE TYPE "public"."unit_condition" AS ENUM('Great', 'Good', 'Bad', 'Broken');--> statement-breakpoint
CREATE TYPE "public"."unit_position" AS ENUM('มุม', 'ริม', 'หน้าบ้าน/หน้าสวน', 'หน้าบ้านไม่ชนใคร', 'ปกติ', 'ไม่ใกล้ลิฟต์', 'ไม่ใกล้ห้องขยะ', 'วิวโล่ง/วิวสวน', 'หน้าห้องไม่ชนใคร');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'sales', 'support');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_zones" (
	"user_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	CONSTRAINT "user_zones_user_id_zone_id_pk" PRIMARY KEY("user_id","zone_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'sales' NOT NULL,
	"line_user_id" text,
	"employee_code" text,
	"employment_status" text,
	"division" text,
	"position" text,
	"second_position" text,
	"team" text,
	"name_eng" text,
	"name_thai" text,
	"nickname" text,
	"gender" text,
	"nationality" text,
	"phone" text,
	"phone2" text,
	"id_card_no" text,
	"address" text,
	"work_email" text,
	"birthday" date,
	"date_started" date,
	"agreement_files" jsonb,
	"emergency_contacts" jsonb,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_line_user_id_unique" UNIQUE("line_user_id"),
	CONSTRAINT "users_employee_code_unique" UNIQUE("employee_code")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_group_id" text NOT NULL,
	"name" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "line_groups_line_group_id_unique" UNIQUE("line_group_id")
);
--> statement-breakpoint
CREATE TABLE "sla_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" "sla_entity" NOT NULL,
	"potential" text NOT NULL,
	"max_days" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transit_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "station_type" NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_code" text,
	"code" text NOT NULL,
	"name_eng" text NOT NULL,
	"name_thai" text,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zones_legacy_code_unique" UNIQUE("legacy_code"),
	CONSTRAINT "zones_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"phone" text,
	"line_id" text,
	"email" text,
	"gender" text,
	"nationality" text,
	"age_range" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"phone" text,
	"line_id" text,
	"email" text,
	"gender" text,
	"nationality" text,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"channel" "listing_channel_name" NOT NULL,
	"url" text,
	"boosted" boolean DEFAULT false NOT NULL,
	"last_pushed_at" date,
	"marketing_report_link" text,
	"facebook_ad_doc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"r2_key" text NOT NULL,
	"source_drive_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"edited_at" timestamp with time zone,
	"column_name" text,
	"old_value" text,
	"new_value" text,
	"status" "listing_update_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_code" text,
	"listing_name" text,
	"status" "listing_status" DEFAULT 'ข้อมูลยังไม่ครบ' NOT NULL,
	"potential" "potential",
	"listing_type" "listing_type",
	"agent_id" uuid,
	"zone_id" uuid,
	"project_id" uuid,
	"listed_at" date,
	"posted_at" date,
	"closed_at" date,
	"property_type" "property_type",
	"in_project" boolean,
	"street_soi" text,
	"location_grade" "location_grade",
	"bts_station_id" uuid,
	"mrt_station_id" uuid,
	"arl_station_id" uuid,
	"unit_type_name" text,
	"unit_no" text,
	"bed" smallint,
	"bath" smallint,
	"maid_room" smallint,
	"land_rai" smallint,
	"land_ngan" smallint,
	"land_wa" numeric(8, 2),
	"usable_sqm" numeric(10, 2),
	"floor" text,
	"building" text,
	"view" text,
	"direction" "direction",
	"position" "unit_position",
	"parking" text,
	"unit_condition" "unit_condition",
	"asking_price" numeric(14, 2),
	"rental_price" numeric(12, 2),
	"price_remark" "price_remark",
	"owner_id" uuid,
	"owner_talk_count" integer DEFAULT 0 NOT NULL,
	"last_followed_at" date,
	"post_remark" text,
	"remark_cream" text,
	"google_maps_link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_legacy_code_unique" UNIQUE("legacy_code")
);
--> statement-breakpoint
CREATE TABLE "project_personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sales_id" uuid,
	"persona" text NOT NULL,
	"trust_trigger" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_personas_trust_trigger_check" CHECK (trust_trigger IS NULL OR trust_trigger IN ('เชื่อจากข้อมูลรองรับ', 'เชื่อจากความสัมพันธ์', 'เชื่อจากภาพลักษณ์ที่ดูน่าเชื่อถือ', 'เชื่อจาก Social Proof'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_code" text,
	"name_eng" text,
	"name_thai" text,
	"property_type" text,
	"zone_id" uuid,
	"zone_raw" text,
	"developer" text,
	"year_built" text,
	"buildings" text,
	"floors" text,
	"units" text,
	"parking_ratio" text,
	"extra_parking_purchasable" text,
	"extra_parking_fee" text,
	"highlights" text,
	"common_facilities" text,
	"common_fee" text,
	"common_fee_terms" text,
	"common_fee_collection_pct" text,
	"juristic_person" text,
	"avg_price_per_sqm" text,
	"rental_yield" text,
	"unit_types" text,
	"ceiling_height" text,
	"units_per_floor" text,
	"segment" text,
	"comparables" text,
	"best_view" text,
	"best_direction" text,
	"best_position" text,
	"nationality_mix" text,
	"pets_allowed" text,
	"smoking_allowed" text,
	"shops" text,
	"nearest_station_info" text,
	"shuttle_info" text,
	"keywords" text,
	"target_customers" text,
	"concept" text,
	"pros" text,
	"cons" text,
	"quake_repair_history" text,
	"quake_safety_cert" text,
	"quake_insurance" text,
	"quake_exterior_cracks" text,
	"quake_joints_condition" text,
	"quake_interior_condition" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_legacy_code_unique" UNIQUE("legacy_code")
);
--> statement-breakpoint
CREATE TABLE "deal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"doc_type" "deal_doc_type" NOT NULL,
	"r2_key" text,
	"source_drive_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_code" text,
	"listing_id" uuid,
	"lead_id" uuid,
	"type" text,
	"closing_price" numeric(14, 2),
	"commission" numeric(12, 2),
	"sales_id" uuid,
	"co_agent" text,
	"closing_date" date,
	"transfer_date" date,
	"closing_status" "closing_status",
	"reservation_amount" numeric(12, 2),
	"buyer_fullname" text,
	"buyer_address" text,
	"buyer_id_no" text,
	"seller_fullname" text,
	"seller_address" text,
	"seller_id_no" text,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_legacy_code_unique" UNIQUE("legacy_code")
);
--> statement-breakpoint
CREATE TABLE "last_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_id" uuid,
	"type" "last_match_type",
	"matched_at" date,
	"project_name" text,
	"project_id" uuid,
	"potential" "potential",
	"property_type" "property_type",
	"zone_id" uuid,
	"price" numeric(14, 2),
	"bed" smallint,
	"bath" smallint,
	"sqm" numeric(10, 2),
	"floor" text,
	"tower" text,
	"direction" "direction",
	"remark" text,
	"buyer_persona" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_code" text,
	"contact_id" uuid,
	"listing_id" uuid,
	"initial_interest" text,
	"lead_type" "lead_type",
	"source" "marketing_channel",
	"contact_by" "contact_by",
	"potential" "buyer_potential",
	"lead_status" "lead_status" DEFAULT 'Active' NOT NULL,
	"pipeline_stage" "pipeline_stage" DEFAULT 'Lead' NOT NULL,
	"progress" text,
	"background" text,
	"requirement" text,
	"pain_point" text,
	"budget_million" numeric(8, 2),
	"timeline" text,
	"last_followed_at" date,
	"activity_comment" text,
	"assigned_to" uuid,
	"created_by" uuid,
	"submitted_at" timestamp with time zone,
	"line_user_id" text,
	"assigned_by" uuid,
	"complain" text,
	"complain_severity" "complain_severity",
	"complain_status" "complain_status",
	"commission" numeric(12, 2),
	"bank_loan" text,
	"closing_unit" text,
	"closing_date" date,
	"transfer_date" date,
	"closing_remark" text,
	"case_status" "case_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_legacy_code_unique" UNIQUE("legacy_code")
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"agent_id" uuid NOT NULL,
	"category" "action_category" NOT NULL,
	"quantity" integer,
	"hours" numeric(5, 2),
	"remark" text,
	"recap" "recap",
	"what_happened" text,
	"why" text,
	"improvement_plan" text,
	"listing_id" uuid,
	"lead_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_plan_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"listing_id" uuid,
	"lead_id" uuid,
	"start_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date,
	"user_id" uuid,
	"category" text,
	"tool" text,
	"feedback" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"agent_id" uuid,
	"goal_type" text,
	"target_amount" numeric(14, 2),
	"start_date" date,
	"target_date" date,
	"status" "goal_status" DEFAULT 'Planned' NOT NULL,
	"remark" text,
	"recap" "recap",
	"what_happened" text,
	"why" text,
	"improvement_plan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_allowances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"sick_days" numeric(4, 1),
	"personal_days" numeric(4, 1),
	"vacation_days" numeric(4, 1)
);
--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"type" "leave_type" NOT NULL,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_zones" ADD CONSTRAINT "user_zones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_zones" ADD CONSTRAINT "user_zones_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_channels" ADD CONSTRAINT "listing_channels_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_updates" ADD CONSTRAINT "listing_updates_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_updates" ADD CONSTRAINT "listing_updates_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_bts_station_id_transit_stations_id_fk" FOREIGN KEY ("bts_station_id") REFERENCES "public"."transit_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_mrt_station_id_transit_stations_id_fk" FOREIGN KEY ("mrt_station_id") REFERENCES "public"."transit_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_arl_station_id_transit_stations_id_fk" FOREIGN KEY ("arl_station_id") REFERENCES "public"."transit_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_personas" ADD CONSTRAINT "project_personas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_personas" ADD CONSTRAINT "project_personas_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "last_matches" ADD CONSTRAINT "last_matches_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "last_matches" ADD CONSTRAINT "last_matches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "last_matches" ADD CONSTRAINT "last_matches_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ADD CONSTRAINT "daily_plan_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ADD CONSTRAINT "daily_plan_tasks_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_tasks" ADD CONSTRAINT "daily_plan_tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_allowances" ADD CONSTRAINT "leave_allowances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sla_rules_entity_potential_idx" ON "sla_rules" USING btree ("entity","potential");--> statement-breakpoint
CREATE UNIQUE INDEX "transit_stations_type_code_idx" ON "transit_stations" USING btree ("type","code");--> statement-breakpoint
CREATE INDEX "contacts_phone_idx" ON "contacts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "owners_phone_idx" ON "owners" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_channels_listing_channel_idx" ON "listing_channels" USING btree ("listing_id","channel");--> statement-breakpoint
CREATE INDEX "listing_media_listing_idx" ON "listing_media" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_updates_listing_idx" ON "listing_updates" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_updates_status_idx" ON "listing_updates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_agent_idx" ON "listings" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "listings_zone_idx" ON "listings" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_project_idx" ON "listings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "listings_owner_idx" ON "listings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "project_personas_project_idx" ON "project_personas" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "deal_documents_deal_idx" ON "deal_documents" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deals_sales_idx" ON "deals" USING btree ("sales_id");--> statement-breakpoint
CREATE INDEX "deals_listing_idx" ON "deals" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "last_matches_sales_idx" ON "last_matches" USING btree ("sales_id");--> statement-breakpoint
CREATE INDEX "leads_assigned_to_idx" ON "leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "leads_pipeline_stage_idx" ON "leads" USING btree ("pipeline_stage");--> statement-breakpoint
CREATE INDEX "leads_contact_idx" ON "leads" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "leads_listing_idx" ON "leads" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "actions_agent_date_idx" ON "actions" USING btree ("agent_id","date");--> statement-breakpoint
CREATE INDEX "daily_plan_tasks_user_date_idx" ON "daily_plan_tasks" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_allowances_user_year_idx" ON "leave_allowances" USING btree ("user_id","year");--> statement-breakpoint
CREATE INDEX "leaves_user_idx" ON "leaves" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");