-- The ledger learns that money sits in more than one place (Ben, 2026-09-11:
-- "ระบบบัญชี -> เพิ่ม account transaction อีกอัน -> show รวมเป็น dashboard
-- ได้").
--
-- WHAT WAS ASSUMED. `transactions` had no account column at all. Every balance
-- in the app was one running sum over every row, labelled "ยอดคงเหลือ
-- (ทั้งบัญชี)" — a correct label for exactly one account and a misleading one
-- the moment there are two.
--
-- account_id IS NOT NULL, which is why this migration is four statements
-- instead of one: the column has to exist, be filled, and only then be
-- constrained. Nullable would have been a single ALTER and a permanent
-- ambiguity — a row with no account is a balance belonging to nobody, and
-- there is no safe default to read it as once a second account exists.
--
-- THE BACKFILL TARGET IS CREATED HERE rather than left to the app, because
-- NOT NULL needs something to point at and because an empty accounts table
-- would make /ledger unusable on first load. It is named บัญชีบริษัท and marked
-- default; the bookkeeper renames it and sets its opening balance in the app.
--
-- transfer_group_id ARRIVES NOW, NOT LATER. The first thing that happens after
-- a second account exists is money moving between them, and the obvious way to
-- record that — one "เงินออก" here, one "เงินเข้า" there — books a transfer as
-- both an expense and revenue. Both balances would be right and every margin
-- on the P&L would be wrong, silently. Pairing the legs is what lets the
-- statement skip them.
CREATE TABLE IF NOT EXISTS "ledger_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "kind" text DEFAULT 'bank' NOT NULL,
  "bank_name" text,
  "account_no" text,
  "opening_balance_satang" bigint DEFAULT 0 NOT NULL,
  "opening_date" date,
  "is_default" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "note" text,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- At most one default, enforced by the database. Two would make "which account
-- did this commission post into" answerable two different ways.
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_default_idx" ON "ledger_accounts" ("is_default") WHERE "is_default";
--> statement-breakpoint
INSERT INTO "ledger_accounts" ("name", "kind", "is_default", "sort_order", "note")
SELECT 'บัญชีบริษัท', 'bank', true, 0, 'บัญชีตั้งต้น — รายการทั้งหมดที่มีอยู่เดิมถูกย้ายมาที่นี่ แก้ชื่อและใส่ยอดยกมาได้'
WHERE NOT EXISTS (SELECT 1 FROM "ledger_accounts");
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "transfer_group_id" uuid;
--> statement-breakpoint
UPDATE "transactions" SET "account_id" = (SELECT "id" FROM "ledger_accounts" WHERE "is_default" LIMIT 1) WHERE "account_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
-- RESTRICT (the default): an account with history cannot be deleted. The app
-- offers archive instead — the rows pointing here are claims about where money
-- actually went, and they must not be orphaned or silently reassigned.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_account_date_idx" ON "transactions" ("account_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_transfer_idx" ON "transactions" ("transfer_group_id");
--> statement-breakpoint
-- A COLUMN DEFAULT SO THIS MIGRATION IS SAFE TO APPLY BEFORE THE CODE DEPLOY.
--
-- Deploying here is manual and the database routinely runs ahead of the Worker
-- (0030-0034 all did). Every one of those was additive and the running code
-- could ignore it. THIS ONE IS NOT: `account_id` is NOT NULL, and the code
-- currently live inserts into `transactions` without it — from the /ledger
-- form and, more dangerously, from syncDealLedger(), which every deal save
-- calls. Applied bare against production, the next commission entered would
-- fail its INSERT and take the whole deal save down with it.
--
-- So the column gets a default pointing at the account that exists, and the
-- schema change stops caring whether the code arrives before or after it.
--
-- THE APP NEVER RELIES ON THIS. lib/db/schema/sales.ts deliberately does NOT
-- declare a drizzle default, which keeps `accountId` REQUIRED at compile time
-- — it is what made the type checker point at both insert sites when the
-- column was added. Strict in the type system, forgiving in the database: the
-- default is a deploy-window safety net, not an API.
--
-- Chosen by lookup rather than hardcoded, so this is also correct on a
-- database that already had accounts before this migration ran.
DO $$
DECLARE fallback uuid;
BEGIN
  SELECT "id" INTO fallback FROM "ledger_accounts"
   ORDER BY "is_default" DESC, "sort_order", "created_at" LIMIT 1;
  IF fallback IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "transactions" ALTER COLUMN "account_id" SET DEFAULT %L', fallback);
  END IF;
END $$;
