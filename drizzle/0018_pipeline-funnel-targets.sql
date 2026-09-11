-- ความเคลื่อนไหว — the pipeline card ported from Klaichan CRM (Ben, 2026-08-28).
--
-- Three additions, none destructive:
--   options.stage_key   which pipeline stage an action_category ADVANCES
--   options.scope       owner-side (acquisition) vs buyer-side (funnel) work
--   agent_targets       per-agent standing targets per funnel step / category
--
-- WHY stage_key AND NOT A NAME MATCH. Six action categories happen to be
-- spelled exactly like six pipeline stages (Call · Follow · Appoint · Show ·
-- Nego · Close), which makes a string compare look free. Klaichan's notes are
-- explicit that this is a trap — the two lists "only agreed by coincidence of
-- labels" until a real column existed, and either list is editable in Settings
-- by someone who has no idea the other one depends on the spelling. The
-- backfill below uses that coincidence ONCE, here, where it is visible.

ALTER TABLE "options" ADD COLUMN "stage_key" text;--> statement-breakpoint
ALTER TABLE "options" ADD COLUMN "scope" text;--> statement-breakpoint

-- Buyer side: the six categories that advance a funnel step, matched to the
-- stage of the same name. Guarded on kind so no other picklist is touched.
UPDATE "options" SET "stage_key" = "key", "scope" = 'buyer'
 WHERE "kind" = 'action_category'
   AND "key" IN ('Call', 'Follow', 'Appoint', 'Show', 'Nego', 'Close');--> statement-breakpoint

-- Owner side: acquisition. Advances no buyer stage, so stage_key stays NULL
-- and these are targeted per category instead (lib/targets.ts kindMetric).
UPDATE "options" SET "scope" = 'owner'
 WHERE "kind" = 'action_category'
   AND "key" IN ('New List', 'Owner Visit', 'Owner Talk', 'Survey');--> statement-breakpoint

-- Everything else (โอนกรรมสิทธิ์, ประชุม, ทำงานหน้าคอม, อื่นๆ …) is left with
-- scope NULL on purpose: it is real work but it belongs to neither funnel, and
-- guessing it into one would inflate a number somebody is measured on. Such
-- rows are simply absent from both halves of the card.

CREATE TABLE "agent_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"period" text NOT NULL,
	"period_key" text DEFAULT '' NOT NULL,
	"amount" integer NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "agent_targets" ADD CONSTRAINT "agent_targets_agent_id_users_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_targets" ADD CONSTRAINT "agent_targets_updated_by_users_id_fk"
  FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "agent_targets_agent_metric_period_idx"
  ON "agent_targets" USING btree ("agent_id","metric","period","period_key");
