-- บัญชี becomes a seat, and the deal sign-off moves into it (Ben, 2026-09-11:
-- "add role บัญชี -> มีหน้ารวมเคสที่ปิด + recheck ความถูกต้อง", then
-- "บัญชีเป็นเจ้าของ ผู้จัดการดูอย่างเดียว").
--
-- WHY A SIXTH ROLE RATHER THAN A FLAG ON AN EXISTING ONE. The two permissions
-- an accountant needs — `ledger` and `dealReview` — currently sit on
-- ซูเปอร์แอดมิน and ผู้จัดการ, and both of those rows carry a great deal else.
-- Granting either to the bookkeeper would hand over HR records or the whole
-- team's pipeline to get at the commission numbers. Nothing in the existing
-- five is shaped like this job.
--
-- MANAGER LOSES dealReview. Not a demotion — the rule already written twice on
-- that row (listingUpdateQueue, intakeAssign): a queue with two owners has
-- none. The evidence is unusually clean here. The sign-off has existed since
-- the deal module shipped; ซูเปอร์แอดมิน and ผู้จัดการ have both held it the
-- whole time; production holds 39 closed deals and 0 have ever been signed
-- off. Shared ownership did not make review slow, it made review absent.
-- ซูเปอร์แอดมิน keeps it as break-glass, which after 0034 is a rule rather
-- than a habit.
--
-- EVERY ROLE IS NAMED on dealReview, including the ones whose value does not
-- change, for the reason 0034 paid for: a role left unset does not keep its
-- matrix default — parsePerms silently gives it the SALES value. Writing
-- `false` where false is already correct costs one statement and removes the
-- only way this migration could be wrong later.
--
-- THE NEW ROW CARRIES ALL 21 KEYS for the same reason. A seed row missing a
-- key is a permission that degrades to sales on the next read, and the role
-- would look right in Settings while behaving differently.
INSERT INTO "roles" ("id", "name", "description", "system", "sort_order", "perms")
VALUES (
  'accounting',
  'บัญชี',
  'ดูแลเงินหลังปิดดีล — ตรวจคอมมิชชัน ส่วนแบ่ง และวันรับเงิน แล้วล็อกตัวเลข · คุมสมุดบัญชีทุกบัญชีและงบกำไรขาดทุน · ไม่แตะทรัพย์ Lead หรือการตั้งค่า',
  true,
  15,
  '{
    "listings": "none",
    "leads": "none",
    "deals": "all",
    "dealLegalPII": true,
    "ownerContacts": "own-listings",
    "listingDirectory": false,
    "leadDirectory": false,
    "listingUpdateQueue": false,
    "goals": "own",
    "lastMatch": "own",
    "intakeAssign": false,
    "leadCreate": false,
    "focusDirectory": false,
    "targetsSet": false,
    "settings": false,
    "teamManage": false,
    "leaveApprove": false,
    "ledger": true,
    "viewAudit": false,
    "dealReview": true,
    "aiParse": false
  }'::jsonb
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"dealReview": true}'::jsonb  WHERE "id" = 'superadmin';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"dealReview": false}'::jsonb WHERE "id" = 'manager';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"dealReview": false}'::jsonb WHERE "id" = 'sales';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"dealReview": false}'::jsonb WHERE "id" = 'admin_support';
--> statement-breakpoint
UPDATE "roles" SET "perms" = "perms" || '{"dealReview": false}'::jsonb WHERE "id" = 'listing_support';
