// Contacts repository — the one person book (was owners.ts until 2026-08-25,
// when the `owners` table merged into `contacts`).
//
// Visibility, per DATA_MODEL §5 and widened for the merge:
//   ownerContacts "all"          → admin / manager / support see every person
//   ownerContacts "own-listings" → sales see a person they are connected to:
//                                  the owner of one of THEIR listings, or the
//                                  contact on one of THEIR leads.
//
// The lead arm is new and it is not a loosening — before the merge, buyers
// lived in a separate table this page never showed, so a sales agent could not
// reach their own buyer here at all. The rule is unchanged in spirit: you see
// the people you work with, nobody else's.

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contacts, leads, listings } from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/phone";
import { leadScope, listingScope } from "./scope";

export const CONTACTS_PAGE_SIZE = 25;

/** WHERE fragment limiting `contacts` to what the viewer may see. */
export function contactScope(viewer: Viewer): SQL | undefined {
  if (viewer.perms.ownerContacts === "all") return undefined;
  return or(
    sql`exists (select 1 from ${listings} where ${listings.ownerId} = ${contacts.id} and ${listings.agentId} = ${viewer.userId})`,
    sql`exists (select 1 from ${leads} where ${leads.contactId} = ${contacts.id} and (${leads.assignedTo} = ${viewer.userId} or ${leads.createdBy} = ${viewer.userId}))`
  );
}

/* ── the two counts, and why they are written by hand ───────────────────
   "3 ทรัพย์ · 1 Lead" next to a person, counted the same way the visibility
   rule that surfaced them was: a scoped viewer counts only THEIR listings
   and leads, so a sales agent never learns this person also works with
   somebody else.

   THE CORRELATION IS SPELLED OUT IN LITERAL SQL because Drizzle renders an
   interpolated column UNQUALIFIED inside a select projection — `${contacts.id}`
   comes out as "id", which inside `from listings` binds to listings.id and
   makes the whole subquery `listings.owner_id = listings.id`, i.e. always
   zero. (It qualifies correctly inside a WHERE, which is why contactScope
   above is fine written the interpolated way.) This was silently returning
   0 ทรัพย์ / 0 Lead for every row on the /contacts page. */
function scopedCounts(viewer: Viewer) {
  const uid = viewer.userId;
  const all = viewer.perms.ownerContacts === "all";
  return {
    listingCount: all
      ? sql<number>`(select count(*)::int from listings l where l.owner_id = contacts.id)`
      : sql<number>`(select count(*)::int from listings l where l.owner_id = contacts.id and l.agent_id = ${uid})`,
    leadCount: all
      ? sql<number>`(select count(*)::int from leads ld where ld.contact_id = contacts.id)`
      : sql<number>`(select count(*)::int from leads ld where ld.contact_id = contacts.id and (ld.assigned_to = ${uid} or ld.created_by = ${uid}))`,
  };
}

export interface ContactFilters {
  q?: string;
  page?: number;
}

export async function listContacts(viewer: Viewer, f: ContactFilters) {
  const db = getDb();
  const parts: (SQL | undefined)[] = [contactScope(viewer)];
  if (f.q) {
    const like = `%${f.q}%`;
    parts.push(
      or(
        ilike(contacts.name, like),
        ilike(contacts.phone, like),
        ilike(contacts.lineId, like)
      )
    );
  }
  // and() drops undefined and returns undefined for none
  const where = and(...parts);
  const page = Math.max(1, f.page ?? 1);

  const { listingCount, leadCount } = scopedCounts(viewer);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phone,
        lineId: contacts.lineId,
        email: contacts.email,
        updatedAt: contacts.updatedAt,
        listingCount,
        leadCount,
      })
      .from(contacts)
      .where(where)
      .orderBy(desc(contacts.updatedAt))
      .limit(CONTACTS_PAGE_SIZE)
      .offset((page - 1) * CONTACTS_PAGE_SIZE),
    db.select({ total: count() }).from(contacts).where(where),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE)),
  };
}

export async function getContact(viewer: Viewer, id: string) {
  const [row] = await getDb()
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), contactScope(viewer)))
    .limit(1);
  return row ?? null;
}

/** Listings this person OWNS that the viewer may see (listingScope, not contact scope). */
export async function getContactListings(viewer: Viewer, contactId: string) {
  return getDb()
    .select({
      id: listings.id,
      listingName: listings.listingName,
      legacyCode: listings.legacyCode,
      status: listings.status,
      potential: listings.potential,
      askingPrice: listings.askingPrice,
      rentalPrice: listings.rentalPrice,
    })
    .from(listings)
    .where(and(eq(listings.ownerId, contactId), listingScope(viewer)))
    .orderBy(desc(listings.updatedAt), asc(listings.legacyCode));
}

/** Leads where this person is the BUYER, scoped the same way. The other half
    of the merge: one page now shows both sides of a person. */
export async function getContactLeads(viewer: Viewer, contactId: string) {
  return getDb()
    .select({
      id: leads.id,
      legacyCode: leads.legacyCode,
      initialInterest: leads.initialInterest,
      pipelineStage: leads.pipelineStage,
      leadStatus: leads.leadStatus,
      potential: leads.potential,
      budgetMillion: leads.budgetMillion,
    })
    .from(leads)
    .where(and(eq(leads.contactId, contactId), leadScope(viewer)))
    .orderBy(desc(leads.updatedAt));
}

/* ── picker search ─────────────────────────────────────────────────
   Behind the เจ้าของทรัพย์ / ผู้ติดต่อ picker on the listing and lead forms
   (Ben, 2026-08-29: "what if the new listing owner are already on that
   contact.. how will the user search and select that easily?").

   TWO ARMS, AND THE SPLIT IS THE WHOLE POINT:

     by name/LINE  → contactScope only. A sales agent sees the people they
                     already work with. Searching the whole book by name would
                     let anyone enumerate another agent's owners one letter at
                     a time, which is exactly what contactScope exists to stop.
     by full phone → the whole book. You cannot enumerate a phone book by
                     guessing 10-digit numbers, and you learn nothing you were
                     not about to learn anyway: resolveOwnerId has ALWAYS
                     deduped on that number at save time. This arm only makes
                     the link visible BEFORE you commit to it, instead of
                     after.

   An out-of-scope match comes back with its counts nulled. That someone else
   works with this person is fine to know once you hold their number; how much
   is not. */

export interface ContactMatch {
  id: string;
  name: string | null;
  phone: string | null;
  lineId: string | null;
  email: string | null;
  /** YOUR listings/leads with this person, mirroring listContacts. Null when
      the row came from the exact-phone arm — see above. */
  listingCount: number | null;
  leadCount: number | null;
  /** The viewer would not normally see this person. The picker shows the
      match read-only: linking is allowed, editing their record is not. */
  outsideScope: boolean;
}

const SEARCH_LIMIT = 8;

export async function searchContacts(
  viewer: Viewer,
  raw: string
): Promise<ContactMatch[]> {
  const q = raw.trim();
  // Two characters is the floor: one Thai character matches most of the book
  // and tells the typist nothing.
  if (q.length < 2) return [];

  const db = getDb();
  const scope = contactScope(viewer);
  const phone = normalizePhone(q);
  const like = `%${q}%`;

  const terms = [
    ilike(contacts.name, like),
    ilike(contacts.phone, like),
    ilike(contacts.lineId, like),
  ];
  // "081-234-5678" never ilikes the stored "0812345678"; search the canonical
  // form too so your OWN contact is found however you type the number.
  if (phone) terms.push(ilike(contacts.phone, `%${phone}%`));

  const { listingCount, leadCount } = scopedCounts(viewer);

  const mine = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      lineId: contacts.lineId,
      email: contacts.email,
      listingCount,
      leadCount,
    })
    .from(contacts)
    .where(and(scope, or(...terms)))
    .orderBy(desc(contacts.updatedAt))
    .limit(SEARCH_LIMIT);

  const rows: ContactMatch[] = mine.map((r) => ({ ...r, outsideScope: false }));
  if (!phone || rows.some((r) => r.phone === phone)) return rows;

  // The exact-phone arm, unscoped by design. The scope question is then asked
  // SEPARATELY — as a WHERE, the only place Drizzle qualifies it correctly —
  // because a hit here may still be one of yours that fell past SEARCH_LIMIT.
  const [exact] = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      lineId: contacts.lineId,
      email: contacts.email,
    })
    .from(contacts)
    .where(eq(contacts.phone, phone))
    .limit(1);
  if (!exact) return rows;

  const inScope = scope
    ? Boolean(
        (
          await db
            .select({ id: contacts.id })
            .from(contacts)
            .where(and(eq(contacts.id, exact.id), scope))
            .limit(1)
        )[0]
      )
    : true;

  rows.push({
    ...exact,
    // Counts are omitted on this arm either way: the row is here because of
    // the number, and a second scoped count query to decorate one result is
    // not worth the round trip.
    listingCount: null,
    leadCount: null,
    outsideScope: !inScope,
  });
  return rows;
}

/**
 * Check the ContactPicker's hidden `<prefix>Id` before a save trusts it.
 *
 * `editable` is the SAME rule the rest of the app uses: a contact you can see
 * is one you may write to (app/(app)/contacts/actions.ts updateContact says
 * exactly that), and one you cannot is linkable but never written — which is
 * what the picker promised the user when it froze the fields on an
 * out-of-scope match.
 *
 * Returns null for an id that no longer exists, so a stale pick degrades
 * quietly to the phone dedupe rather than failing the save.
 */
export async function resolvePickedContact(
  viewer: Viewer,
  id: string | null
): Promise<{ id: string; editable: boolean } | null> {
  if (!id) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  if (!row) return null;
  // Two queries, not one projected boolean: contactScope only renders its
  // correlations correctly inside a WHERE (see scopedCounts above).
  const editable = Boolean(await getContact(viewer, row.id));
  return { id: row.id, editable };
}

/**
 * The id of the contact that ALREADY holds this number, if it is not `selfId`.
 *
 * Guards every write to contacts.phone since 0024 made the column unique.
 * Checking beforehand rather than catching the constraint violation is what
 * lets a save keep the rest of the record and report just this one field —
 * a 500 in the middle of a listing form would lose the whole thing.
 *
 * `phone` must already be normalised (lib/phone.ts). The column holds the
 * canonical digits-only form and nothing else, or the uniqueness is
 * decorative: "081-234-5678" and "0812345678" are two distinct strings and
 * both would fit under the index.
 */
export async function phoneTakenBy(
  phone: string,
  selfId: string | null
): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.phone, phone))
    .limit(1);
  if (!row || row.id === selfId) return null;
  return row.id;
}
