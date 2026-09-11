CREATE TABLE "copy_templates" (
	"listing_type" text NOT NULL,
	"tier" text NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"normal" text DEFAULT '' NOT NULL,
	"dd" text DEFAULT '' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copy_templates_listing_type_tier_pk" PRIMARY KEY("listing_type","tier")
);
--> statement-breakpoint
CREATE TABLE "portal_pushes" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"by" uuid
);
--> statement-breakpoint
CREATE TABLE "repost_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"grade_key" text NOT NULL,
	"channel_key" text NOT NULL,
	"days" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "copy_templates" ADD CONSTRAINT "copy_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_pushes" ADD CONSTRAINT "portal_pushes_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_pushes" ADD CONSTRAINT "portal_pushes_by_users_id_fk" FOREIGN KEY ("by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portal_pushes_listing_idx" ON "portal_pushes" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repost_rules_pair_idx" ON "repost_rules" USING btree ("grade_key","channel_key");--> statement-breakpoint
UPDATE "options" SET "role" = 'hot' WHERE "kind" = 'listing_potential' AND "key" IN ('A', 'Exclusive') AND "role" IS NULL;
