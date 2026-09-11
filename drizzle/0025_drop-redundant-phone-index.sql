-- contacts_phone_idx is redundant once 0024's unique index exists.
--
-- Every lookup on this column is `where phone = $1` with a non-null parameter
-- (resolveOwnerId, resolveContactId, phoneTakenBy, the import). The planner
-- can prove that satisfies `WHERE phone IS NOT NULL`, so it uses the partial
-- unique index for exactly the queries the old one served — and that index
-- has to be maintained on every write regardless. Keeping both means paying
-- twice on insert and update to answer the same question once.
DROP INDEX IF EXISTS "contacts_phone_idx";
