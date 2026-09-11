-- A follow is something you WROTE, not a button you pressed (Ben, 2026-08-30:
-- "we don't want ติดตามวันนี้ function on the lead or listing.. we want the
-- activity (history comment log) like Klaichan").
--
-- Until now `markLeadFollowed` / `markListingFollowed` set last_followed_at
-- and wrote NO activity row at all, so the SLA clock could reset with no
-- record of what happened. The record's timeline replaces both buttons: you
-- post what you did, and the post is what moves the clock. That makes an
-- unexplained follow structurally impossible rather than merely discouraged.
--
-- Two columns.

-- 1. WITHDRAWING, NOT DELETING. Cream's words on the same log in Klaichan were
--    "ลงผิดแล้วลบไม่ได้". A mis-filed entry has to come back out of the monthly
--    count, but deleting it leaves a number that dropped with nothing to point
--    at. Voided rows stay visible, struck through, and can be restored — and
--    every count in the app filters them out.
ALTER TABLE "actions" ADD COLUMN IF NOT EXISTS "voided" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- 2. A PLAIN NOTE IS A REAL THING TO WRITE. "เจ้าของติดต่อไม่ได้ทั้งอาทิตย์" is
--    worth keeping on the record and is not a unit of work, so category goes
--    nullable: NULL means โน้ต — it shows in the history, counts for nothing,
--    and deliberately does NOT stamp the SLA clock. If a bare note reset the
--    clock, an overdue queue could be cleared by typing "." on every row.
ALTER TABLE "actions" ALTER COLUMN "category" DROP NOT NULL;
