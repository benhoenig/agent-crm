-- ONE PHONE, ONE PERSON.
--
-- Phone is THE dedupe key for the contacts book: lib/phone.ts normalises it,
-- the Phase 4 import built rows on it, and resolveOwnerId / resolveContactId
-- both find-or-create on it on every listing and lead save. Nothing enforced
-- it. Two rows could come to hold the same number — through a contact edit, or
-- a race between two saves — and from that moment every lookup between them
-- was arbitrary: `.where(eq(contacts.phone, phone)).limit(1)` over an
-- unordered scan, so the same number could resolve to a different person on
-- consecutive saves and quietly split one owner's history across two records.
--
-- PARTIAL, because a contact with no phone is ordinary and expected: 211 of
-- 1,684 rows today (an owner reached only by LINE, a buyer with a name and
-- nothing else). Those must stay unconstrained, and a plain UNIQUE would
-- allow them anyway — spelling the predicate out says it is intentional.
--
-- Both branches were clean when this was written (1,473 numbers, 0 duplicated
-- on production AND development), so it takes effect with nothing to merge.
-- If that ever stops being true, this fails loudly at migrate time rather
-- than silently picking a winner — which is the right way round.
--
-- contacts_phone_idx is left in place. It is now redundant (the planner can
-- prove `phone = $1` satisfies the partial predicate), but dropping an index
-- is not this migration's job.
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_phone_unique"
  ON "contacts" ("phone")
  WHERE "phone" IS NOT NULL;
