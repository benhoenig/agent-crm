"use server";

// Contact actions. Mostly mutations, plus the one read the ContactPicker
// needs (lookupContacts, at the bottom) — a client component cannot call the
// repo directly, and giving the search its own route would put the scope rule
// in two places.
//
// There is deliberately NO createContact action here —
// people are created (and deduped by phone) from the listing form's embedded
// owner fields (app/(app)/listings/actions.ts → resolveOwnerId) and from the
// lead form's contact fields, mirroring how the import built them.
//
// AND NO PLAIN DELETE, still. mergeContacts (below) is the one action that
// removes a contact row, and it earns that by repointing every reference
// first — the objection was never "deleting is bad", it was that a bare
// delete orphans the history hanging off the person.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contacts, leads, listings, ownerLinks } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import {
  getContact,
  contactScope,
  phoneTakenBy,
  searchContacts,
  type ContactMatch,
} from "@/lib/repo/contacts";
import { normalizePhone } from "@/lib/phone";
import { str } from "@/lib/forms";

export async function updateContact(id: string, fd: FormData) {
  const viewer = await getViewer();

  // Re-check visibility with the same rule the read path uses, so a sales
  // agent cannot update a contact outside their own scope by forging the
  // action call. The scope fragment is ALSO in the UPDATE WHERE below.
  const existing = await getContact(viewer, id);
  if (!existing) redirect("/contacts");

  /* THE PHONE IS NORMALISED HERE, and it was not before. Every other writer
     stores the canonical digits-only form (lib/phone.ts — the import, both
     form resolvers); this one stored whatever was typed. "081-234-5678" and
     "0812345678" are two different strings, so one raw write was enough to
     put a second copy of a person under the unique index added in 0024 and
     leave the dedupe looking up the wrong one. */
  const raw = str(fd, "phone");
  const phone = normalizePhone(raw);
  // Typed something that is not a number at all (a LINE handle, a note).
  const invalid = raw !== null && phone === null;
  const taken = phone ? await phoneTakenBy(phone, id) : null;
  // Keep the column as it was rather than failing the whole save: six good
  // fields written and one field explained beats an edit that vanished.
  // raw === null is a deliberate clear and still goes through.
  const keep = invalid || taken !== null;

  await getDb()
    .update(contacts)
    .set({
      name: str(fd, "name"),
      ...(keep ? {} : { phone }),
      lineId: str(fd, "lineId"),
      email: str(fd, "email"),
      gender: str(fd, "gender"),
      nationality: str(fd, "nationality"),
      remark: str(fd, "remark"),
    })
    .where(and(eq(contacts.id, id), contactScope(viewer)));

  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
  // Back to the form, not the record, when the number did not take — that is
  // where the field is and where the message means something.
  if (keep) redirect(`/contacts/${id}/edit?phone=${taken ? "taken" : "invalid"}`);
  redirect(`/contacts/${id}`);
}


/* ── owner report link ─────────────────────────────────────────────── */

/** Create (or rotate) the owner's report link — one live link per owner, so
    creating a new one revokes any old one first. The owner must be visible
    to the viewer under the same rule the read path uses. */
export async function createOwnerLink(id: string) {
  const viewer = await getViewer();
  const existing = await getContact(viewer, id);
  if (!existing) redirect("/contacts");
  const db = getDb();

  await db
    .update(ownerLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(ownerLinks.ownerId, id), isNull(ownerLinks.revokedAt)));
  await db.insert(ownerLinks).values({
    token: crypto.randomUUID().replace(/-/g, ""),
    ownerId: id,
    createdBy: viewer.userId,
  });
  revalidatePath(`/contacts/${id}`);
}

export async function revokeOwnerLink(id: string) {
  const viewer = await getViewer();
  const existing = await getContact(viewer, id);
  if (!existing) redirect("/contacts");
  await getDb()
    .update(ownerLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(ownerLinks.ownerId, id), isNull(ownerLinks.revokedAt)));
  revalidatePath(`/contacts/${id}`);
}


/* ── merge ─────────────────────────────────────────────────────────── */

/**
 * Fold `loserId` into `winnerId` — one person who ended up as two rows.
 *
 * EXACTLY THREE COLUMNS POINT AT A CONTACT: leads.contact_id,
 * listings.owner_id and owner_links.owner_id. The batch below repoints all
 * three, and it is correct only while that list is complete. Shares, share
 * listings, feedback events and activities are NOT named here because they
 * hang off the lead or the listing and follow those two repoints. A fourth
 * reference to contacts means a fourth statement in the batch.
 *
 * WHY THIS EXISTS. The phone column is uniquely indexed, so the same NUMBER
 * can never be stored twice. What still splits a person in two is everything
 * that index cannot see: a customer who comes back on a new number, an
 * intake typed from a name with no phone at all, a number entered with a
 * typo. The picker now warns about those on create (see ContactPicker's
 * dedupe); this is the repair for the ones already in the book.
 *
 * FILL-ONLY-BLANKS (Ben, 2026-09-11). The winner keeps every value it has and
 * takes the loser's only where it had none. It is the rule resolveOwnerId and
 * resolveContactId already use for shared contacts, so it is the one the data
 * was built under.
 *
 * NOTHING IS DISCARDED SILENTLY. A field where both rows had a DIFFERENT
 * value — the second phone number, which is usually the very reason the
 * duplicate exists — is appended to the winner's remark instead of being
 * dropped. lib/phone.ts has carried an extraPhones() for exactly this shape
 * of loss since the import.
 *
 * ATOMIC, VIA BATCH. The Neon HTTP driver has no interactive transactions
 * (see lib/db/index.ts) and app code must not pretend otherwise. It does have
 * db.batch(), which drizzle compiles to Neon's batch endpoint — one request,
 * one server-side transaction, all-or-nothing. So the reads and the decision
 * happen here in JS, and every WRITE goes in one batch. A merge that half
 * applied would be worse than the duplicate it was fixing.
 */
export async function mergeContacts(winnerId: string, loserId: string) {
  const viewer = await getViewer();

  // Whole-book roles only (admin_support, superadmin, manager). A scoped
  // agent sees a fraction of the book, so "these two are the same person" is
  // not a judgement they are equipped to make — the half they cannot see is
  // exactly the half that would be destroyed.
  if (viewer.perms.ownerContacts !== "all") redirect("/contacts");
  if (winnerId === loserId) return;

  const db = getDb();
  const [winner] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, winnerId))
    .limit(1);
  const [loser] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, loserId))
    .limit(1);
  if (!winner || !loser) redirect("/contacts");

  // Fill only where the winner is blank.
  const merged = {
    name: winner.name ?? loser.name,
    phone: winner.phone ?? loser.phone,
    lineId: winner.lineId ?? loser.lineId,
    email: winner.email ?? loser.email,
    gender: winner.gender ?? loser.gender,
    nationality: winner.nationality ?? loser.nationality,
    ageRange: winner.ageRange ?? loser.ageRange,
  };

  // What fill-only-blanks would have thrown away: the loser held a value and
  // the winner held a DIFFERENT one, so the merge keeps the winner's.
  const LABELS: Record<string, string> = {
    name: "ชื่อ",
    phone: "เบอร์โทร",
    lineId: "LINE",
    email: "อีเมล",
    gender: "เพศ",
    nationality: "สัญชาติ",
    ageRange: "ช่วงอายุ",
  };
  const dropped = Object.keys(LABELS)
    .map((k) => {
      const mine = winner[k as keyof typeof winner];
      const theirs = loser[k as keyof typeof loser];
      return theirs && mine && mine !== theirs
        ? `${LABELS[k]}: ${String(theirs)}`
        : null;
    })
    .filter(Boolean);

  const remark =
    [
      winner.remark,
      loser.remark,
      dropped.length
        ? `[รวมรายชื่อซ้ำ ${new Date().toISOString().slice(0, 10)}] ข้อมูลเดิมอีกชุด — ${dropped.join(" · ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n") || null;

  /* ORDER MATTERS INSIDE THE BATCH, and the constraint that forces it is the
     partial unique index on phone. When the winner has no number and the
     loser does, writing that number onto the winner while the loser still
     holds it is a unique violation — which would abort the whole batch. So
     the loser is deleted BEFORE the winner is updated, and its references are
     repointed before that so the delete cascades onto nothing. */
  await db.batch([
    db
      .update(leads)
      .set({ contactId: winnerId })
      .where(eq(leads.contactId, loserId)),
    db
      .update(listings)
      .set({ ownerId: winnerId })
      .where(eq(listings.ownerId, loserId)),
    db
      .update(ownerLinks)
      .set({ ownerId: winnerId })
      .where(eq(ownerLinks.ownerId, loserId)),
    db.delete(contacts).where(eq(contacts.id, loserId)),
    db.update(contacts).set({ ...merged, remark }).where(eq(contacts.id, winnerId)),
    /* createOwnerLink's invariant is one LIVE link per owner, kept in code
       rather than by a constraint. Both rows may have had one, and after the
       repoint above the winner would hold two. Keep the newest — the one most
       likely to be the URL the seller actually has — and revoke the rest. The
       subquery reads the pre-update snapshot, so it cannot select the row it
       is about to revoke. */
    db
      .update(ownerLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(ownerLinks.ownerId, winnerId),
          isNull(ownerLinks.revokedAt),
          sql`${ownerLinks.id} <> (
            select l.id from owner_links l
            where l.owner_id = ${winnerId} and l.revoked_at is null
            order by l.created_at desc, l.id desc
            limit 1
          )`
        )
      ),
  ]);

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${winnerId}`);
  revalidatePath("/leads");
  revalidatePath("/listings");
  redirect(`/contacts/${winnerId}`);
}

/* ── picker lookup ─────────────────────────────────────────────────── */

/** Typeahead behind the เจ้าของทรัพย์ / ผู้ติดต่อ picker. The scope split —
 *  name search inside your own book, exact phone across all of it — lives in
 *  searchContacts; this is only the door a client component can knock on. */
export async function lookupContacts(q: string): Promise<ContactMatch[]> {
  const viewer = await getViewer();
  return searchContacts(viewer, q);
}
