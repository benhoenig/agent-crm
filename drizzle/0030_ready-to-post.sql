-- "ข้อมูลครบ รอโพสต์" becomes its own behaviour, not a shade of `preparing`
-- (Ben, 2026-09-11: listing support had no list of what was waiting to be
-- posted, so a listing that went ready sat there until somebody remembered).
--
-- WHY A ROLE AND NOT A NAME MATCH. Status text is the client's to rename in
-- Settings; code recognises a status by its `role` tag and never by its Thai
-- spelling. Until now "ข้อมูลครบ รอโพสต์" and "ข้อมูลยังไม่ครบ" both carried
-- `preparing`, so nothing in the app could tell "support's turn" from "sales
-- hasn't finished typing" — which is exactly the distinction the queue is.
--
-- THE OTHER HALF OF THIS CHANGE IS IN CODE. Eight predicates asked for
-- ["posted","preparing"] to mean "still live inventory". They now ask for
-- ACTIVE_LISTING_ROLES (lib/options/kinds.ts), which includes ready_to_post —
-- without that, every listing in this status would have silently dropped out
-- of the dashboard counts, the focus board, the share picker and the team
-- page the moment this migration ran. The two must ship together.
--
-- Matched on key because that is what identifies the row today; the role is
-- reasserted rather than assumed, so re-running is harmless. If the client has
-- already renamed the status, this no-ops and the role is set from the
-- Settings editor instead (it now offers ready_to_post for listing_status).
UPDATE "options"
   SET "role" = 'ready_to_post', "system" = true
 WHERE "kind" = 'listing_status'
   AND "key" = 'ข้อมูลครบ รอโพสต์';
