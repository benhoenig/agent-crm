-- Two admin-side roles, properly separated (Ben, 2026-08-25):
--
--   admin           receives buyer/renter enquiries from every platform,
--                   files the lead, and assigns/reassigns it to a sales agent.
--   ซัพพอร์ตประกาศ    takes a listing the sales agent filed and posts it across
--                   the portals — ดันประกาศ and คิวแก้ไขทรัพย์ are theirs.
--
-- The seed gave `support` intakeAssign, so listing support could hand out
-- buyers. They keep leads: "all" (read-only in effect — seeing an enquiry is
-- how they know a listing is live) but lose the ability to assign one.
UPDATE "roles"
SET "perms" = "perms" || '{"intakeAssign": false}'::jsonb
WHERE "id" = 'support';--> statement-breakpoint

-- Name/description only where they still match the old seed, so a label Ben
-- has since edited in Settings → สิทธิ์การใช้งาน is never clobbered.
UPDATE "roles"
SET "name" = 'ซัพพอร์ตประกาศ',
    "description" = 'โพสต์ประกาศให้เซลส์บนทุกแพลตฟอร์ม ดูแลคิวแก้ไขทรัพย์และดันประกาศ · ดู Lead ได้แต่ไม่มอบหมาย ไม่เห็นดีล'
WHERE "id" = 'support'
  AND "name" = 'ซัพพอร์ต'
  AND "description" = 'ดูแลข้อมูลประกาศและคิวแก้ไข ไม่เห็นดีล';--> statement-breakpoint

UPDATE "roles"
SET "description" = 'รับ Lead จากทุกช่องทาง มอบหมายและโอนงานให้เซลส์ · เห็นและจัดการได้ทุกอย่าง รวม PII และการตั้งค่า'
WHERE "id" = 'admin'
  AND "description" = 'เห็นและจัดการได้ทุกอย่าง รวมข้อมูล PII และการตั้งค่า';
