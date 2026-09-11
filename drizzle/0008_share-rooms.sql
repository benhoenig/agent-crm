CREATE TABLE "owner_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "owner_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "share_feedback_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"share_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"reasons" text[],
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_listings" (
	"share_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"feedback" text,
	"feedback_reasons" text[],
	"feedback_at" timestamp with time zone,
	CONSTRAINT "share_listings_share_id_listing_id_pk" PRIMARY KEY("share_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"lead_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "owner_links" ADD CONSTRAINT "owner_links_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_links" ADD CONSTRAINT "owner_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_feedback_events" ADD CONSTRAINT "share_feedback_events_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_feedback_events" ADD CONSTRAINT "share_feedback_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_listings" ADD CONSTRAINT "share_listings_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_listings" ADD CONSTRAINT "share_listings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "owner_links_owner_idx" ON "owner_links" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "share_feedback_share_idx" ON "share_feedback_events" USING btree ("share_id");--> statement-breakpoint
CREATE INDEX "shares_lead_idx" ON "shares" USING btree ("lead_id");