-- Five roles: superadmin, manager, sales, admin_support, listing_support
-- (Ben, 2026-08-29: "the current admin is actually superadmin role", "there
-- should be 2 support role — admin support (รับลูกค้า), listing support
-- (ดูแลฝั่งทรัพย์)").
--
-- WHAT WAS WRONG. `admin` held two unrelated jobs: running the system
-- (settings, roles, PII) and being the desk that takes enquiries off the
-- platforms and hands them to sales. They were one role only because one
-- person happened to do both. In a Thai office "แอดมิน" means the second job,
-- so the name was pointing at the wrong half. And `support` was a fine id
-- while there was one support desk; with two it says nothing.
--
--   admin   → superadmin       the system. Loses intakeAssign with the job.
--   (new)     admin_support    รับลูกค้า. Gains intakeAssign.
--   support → listing_support  ดูแลฝั่งทรัพย์. Unchanged but for the name.
--
-- INSERT-MOVE-DELETE, NOT AN UPDATE OF roles.id. user_roles.role_id is a FK
-- with ON DELETE cascade and no ON UPDATE clause, so renaming the primary key
-- in place would be refused. Adding ON UPDATE CASCADE just to rename two rows
-- would leave a live footgun behind for a one-time move.
--
-- PERMS ARE COPIED FROM THE LIVE ROW, not from the code seed: this matrix is
-- editable at /settings/roles, and a superadmin who has already tuned `admin`
-- must not have that work reverted by a rename. The deltas are applied after
-- the copy, so only the fields this migration is actually about move.

-- 1. superadmin — the old admin's live matrix, minus the intake desk.
INSERT INTO "roles" ("id", "name", "description", "system", "sort_order", "perms")
SELECT 'superadmin',
       'ซูเปอร์แอดมิน',
       'ดูแลระบบทั้งหมด — ตั้งค่า สิทธิ์การใช้งาน บัญชีผู้ใช้ และข้อมูล PII · ไม่ได้รับ Lead และไม่ตั้งเป้าให้ใคร',
       true,
       "sort_order",
       "perms" || '{"intakeAssign": false, "leadDirectory": false}'::jsonb
FROM "roles" WHERE "id" = 'admin'
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- 2. listing_support — the old support row, name and matrix intact.
INSERT INTO "roles" ("id", "name", "description", "system", "sort_order", "perms")
SELECT 'listing_support',
       "name",
       'ดูแลฝั่งทรัพย์ — โพสต์ประกาศให้เซลส์บนทุกแพลตฟอร์ม ดูแลคิวแก้ไขทรัพย์และดันประกาศ · ไม่มอบหมาย Lead ไม่เห็นดีล',
       true,
       "sort_order",
       "perms" || '{"leadDirectory": false}'::jsonb
FROM "roles" WHERE "id" = 'support'
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- 3. admin_support — the desk itself. Sorted between sales and listing
--    support, which is also the seat order the position picker reads.
INSERT INTO "roles" ("id", "name", "description", "system", "sort_order", "perms")
VALUES (
  'admin_support',
  'แอดมินซัพพอร์ต',
  'รับลูกค้า — รับ Lead จากทุกช่องทาง ลงข้อมูล แล้วมอบหมายให้เซลส์ · เห็น Lead และทรัพย์ทั้งบริษัท ไม่เห็นดีลและค่าคอม',
  true,
  25,
  '{"listings":"all","leads":"all","deals":"none","dealLegalPII":false,"ownerContacts":"all","listingDirectory":true,"leadDirectory":true,"listingUpdateQueue":false,"goals":"own","intakeAssign":true,"targetsSet":false,"settings":false,"teamManage":false,"leaveApprove":false,"ledger":false,"dealReview":false,"aiParse":true}'::jsonb
)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- 4. Every OTHER role gains the new key at its default, including any custom
--    role someone has added. The DEFAULT is on the LEFT of `||` so the live
--    blob on the right wins — this can only fill a missing key, never
--    overwrite a choice. jsonb_exists() rather than the `?` operator, which
--    some drivers read as a bind placeholder.
UPDATE "roles"
SET "perms" = '{"leadDirectory": false}'::jsonb || "perms"
WHERE NOT jsonb_exists("perms", 'leadDirectory');--> statement-breakpoint

UPDATE "roles"
SET "perms" = "perms" || '{"leadDirectory": true}'::jsonb
WHERE "id" = 'manager';--> statement-breakpoint

-- 5. Move the people. Grants first, then the primary column.
UPDATE "user_roles" SET "role_id" = 'superadmin' WHERE "role_id" = 'admin';--> statement-breakpoint
UPDATE "user_roles" SET "role_id" = 'listing_support' WHERE "role_id" = 'support';--> statement-breakpoint
UPDATE "users" SET "role" = 'superadmin' WHERE "role" = 'admin';--> statement-breakpoint
UPDATE "users" SET "role" = 'listing_support' WHERE "role" = 'support';--> statement-breakpoint

-- 6. The old rows, now unreferenced.
DELETE FROM "roles" WHERE "id" IN ('admin', 'support');
