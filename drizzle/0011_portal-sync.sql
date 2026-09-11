-- 0011_portal-sync — retire the sheet-era "✅" statuses.
--
-- In the sheets, portal-sync state was encoded INSIDE the status vocabulary:
-- sales set the plain value, listing support re-set the "✅" twin after
-- mirroring the change on every portal. The CRM tracks that handoff as
-- listing_updates rows instead (a status change that takes a live listing
-- off the portals is logged status='pending' for the support queue; support
-- marks it 'applied' once the portals match), so each real-world state keeps
-- exactly one status key.

-- Fold the ✅ twins into their plain siblings (rows first, then catalog)…
UPDATE "listings" SET "status" = 'เอาประกาศลงชั่วคราว' WHERE "status" = 'เอาประกาศลงชั่วคราว ✅';--> statement-breakpoint
UPDATE "listings" SET "status" = 'แคนเซิลประกาศ' WHERE "status" = 'แคนเซิลประกาศ ✅';--> statement-breakpoint
DELETE FROM "options" WHERE "kind" = 'listing_status' AND "key" IN ('เอาประกาศลงชั่วคราว ✅', 'แคนเซิลประกาศ ✅');--> statement-breakpoint
-- …and strip the emoji from the keys that only ever existed as ✅.
UPDATE "listings" SET "status" = 'เช่าแล้ว' WHERE "status" = 'เช่าแล้ว ✅';--> statement-breakpoint
UPDATE "listings" SET "status" = 'ขายแล้ว' WHERE "status" = 'ขายแล้ว ✅';--> statement-breakpoint
UPDATE "listings" SET "status" = 'เช่าแล้วเอเจ้นอื่น' WHERE "status" = 'เช่าแล้วเอเจ้นอื่น ✅';--> statement-breakpoint
UPDATE "listings" SET "status" = 'ขายแล้วเอเจ้นอื่น' WHERE "status" = 'ขายแล้วเอเจ้นอื่น ✅';--> statement-breakpoint
UPDATE "options" SET "key" = 'เช่าแล้ว' WHERE "kind" = 'listing_status' AND "key" = 'เช่าแล้ว ✅';--> statement-breakpoint
UPDATE "options" SET "key" = 'ขายแล้ว' WHERE "kind" = 'listing_status' AND "key" = 'ขายแล้ว ✅';--> statement-breakpoint
UPDATE "options" SET "key" = 'เช่าแล้วเอเจ้นอื่น' WHERE "kind" = 'listing_status' AND "key" = 'เช่าแล้วเอเจ้นอื่น ✅';--> statement-breakpoint
UPDATE "options" SET "key" = 'ขายแล้วเอเจ้นอื่น' WHERE "kind" = 'listing_status' AND "key" = 'ขายแล้วเอเจ้นอื่น ✅';
