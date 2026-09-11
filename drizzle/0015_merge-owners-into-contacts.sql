-- Merge `owners` into `contacts` — one person table (Ben, 2026-08-25).
--
-- The split was an import artifact, not a domain decision: owners came from
-- listing columns P-R, contacts from Active Lead fields (DATA_MODEL §39). Same
-- columns, and it had already produced six people held in both tables under
-- different names, co-agents among them.
--
-- `legacy_owner_id` is the mapping column. It is carried through the FK
-- repoints and dropped at the end, so nothing outlives the migration.

ALTER TABLE "contacts" ADD COLUMN "remark" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "legacy_owner_id" uuid;--> statement-breakpoint

-- Owners with no phone-match in contacts become new contact rows. A blank
-- phone can never match, so those always insert rather than collapsing every
-- unreachable owner onto one row.
INSERT INTO "contacts"
  ("name","phone","line_id","email","gender","nationality","remark","legacy_owner_id","created_at","updated_at")
SELECT o."name", o."phone", o."line_id", o."email", o."gender", o."nationality",
       o."remark", o."id", o."created_at", o."updated_at"
FROM "owners" o
WHERE o."phone" IS NULL OR o."phone" = '' OR NOT EXISTS (
  SELECT 1 FROM "contacts" c WHERE c."phone" = o."phone" AND c."phone" <> ''
);--> statement-breakpoint

-- Owners that DO match an existing contact by phone are the same human. Stamp
-- the mapping onto that contact and keep its remark if it had none. The
-- legacy_owner_id IS NULL guard stops this re-stamping rows just inserted
-- above; owners is phone-deduped, so no contact can match two owners.
UPDATE "contacts" c
SET "legacy_owner_id" = o."id",
    "remark" = COALESCE(c."remark", o."remark")
FROM "owners" o
WHERE c."phone" = o."phone"
  AND o."phone" IS NOT NULL AND o."phone" <> ''
  AND c."legacy_owner_id" IS NULL;--> statement-breakpoint

-- Repoint listings.owner_id at the contact that replaced its owner.
ALTER TABLE "listings" DROP CONSTRAINT "listings_owner_id_owners_id_fk";--> statement-breakpoint
UPDATE "listings" l
SET "owner_id" = c."id"
FROM "contacts" c
WHERE c."legacy_owner_id" = l."owner_id";--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_contacts_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."contacts"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Same for the owner-report share links.
ALTER TABLE "owner_links" DROP CONSTRAINT "owner_links_owner_id_owners_id_fk";--> statement-breakpoint
UPDATE "owner_links" ol
SET "owner_id" = c."id"
FROM "contacts" c
WHERE c."legacy_owner_id" = ol."owner_id";--> statement-breakpoint
ALTER TABLE "owner_links" ADD CONSTRAINT "owner_links_owner_id_contacts_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."contacts"("id")
  ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

DROP TABLE "owners";--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN "legacy_owner_id";
