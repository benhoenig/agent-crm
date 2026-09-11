"use server";

// Listing mutations. Scope is enforced by putting listingScope(viewer) in the
// UPDATE's WHERE — a request for a row outside the viewer's scope updates
// nothing. Direct edits are audited into listing_updates as status "applied".

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deleteMedia, putMedia } from "@/lib/media/r2";
import {
  listingChannels,
  listingMedia,
  listings,
  mediaKind,
  contacts,
} from "@/lib/db/schema";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { canCreate, canSeeOwnerOn, listingScope } from "@/lib/repo/scope";
import { toggleFocus } from "@/lib/repo/focus";
import { phoneTakenBy, resolvePickedContact } from "@/lib/repo/contacts";
import { bool, dateStr, enumStr, int, numStr, str } from "@/lib/forms";
import { allKeys, optionStr } from "@/lib/repo/options";
import { auditListingEdit } from "@/lib/repo/listing-audit";
import { closeJob } from "@/lib/ai/jobs";
import { normalizePhone } from "@/lib/phone";
import { bkkToday } from "@/lib/format";

/**
 * Resolve the owner from the form's embedded owner fields, deduped by phone
 * (the import rule). `currentOwnerId` is the listing's linked owner so edits
 * update in place instead of minting duplicates.
 *
 * A phone match on a DIFFERENT owner only fills blank fields — it never
 * overwrites. Owners are shared rows scoped by ownerScope; letting any agent
 * rewrite a matched owner's name/LINE would let them clobber (and probe)
 * another agent's contact data just by typing a phone number.
 */
async function resolveOwnerId(
  fd: FormData,
  currentOwnerId: string | null,
  viewer: Viewer
): Promise<string | null> {
  const db = getDb();
  const name = str(fd, "ownerName");
  // canonical digits-only form — THE dedupe key shared with the import
  const phone = normalizePhone(str(fd, "ownerPhone"));
  const lineId = str(fd, "ownerLineId");

  /* AN EXPLICIT PICK BEATS THE PHONE GUESS. When the picker linked a row it
     posts its id, and the fill-only-blanks compromise below no longer
     applies: the user was shown who this is and whether they could edit
     them, so honour that instead of re-deriving it from a number.
     Phone is written only when it still normalises — a typo must never null
     the key the whole contacts book dedupes on. */
  const picked = await resolvePickedContact(viewer, str(fd, "ownerId"));
  if (picked) {
    if (picked.editable) {
      // Phone is written only when it still normalises AND is not already
      // somebody else's (0024 made that an error, not a mess). Retyping a
      // picked person's number into another person's number is ambiguous —
      // the pick is the clearer statement of intent, so it wins and the
      // number is left alone.
      const free = phone ? !(await phoneTakenBy(phone, picked.id)) : false;
      await db
        .update(contacts)
        .set({ name, lineId, ...(free ? { phone } : {}) })
        .where(eq(contacts.id, picked.id));
    }
    return picked.id;
  }

  if (!name && !phone && !lineId) return currentOwnerId;

  if (phone) {
    const [existing] = await db
      .select({ id: contacts.id, name: contacts.name, lineId: contacts.lineId })
      .from(contacts)
      .where(eq(contacts.phone, phone))
      .limit(1);
    if (existing) {
      if (existing.id === currentOwnerId) {
        // Editing this listing's own owner — posted values are intentional.
        await db
          .update(contacts)
          .set({ name, lineId })
          .where(eq(contacts.id, existing.id));
      } else {
        const fill: { name?: string; lineId?: string } = {};
        if (name && !existing.name) fill.name = name;
        if (lineId && !existing.lineId) fill.lineId = lineId;
        if (Object.keys(fill).length) {
          await db.update(contacts).set(fill).where(eq(contacts.id, existing.id));
        }
      }
      return existing.id;
    }
    // onConflictDoNothing, because the lookup above and this insert are not
    // one statement: two saves racing on a new number would otherwise make
    // the loser throw. The loser re-reads instead and links to the winner,
    // which is the same answer it wanted.
    const [created] = await db
      .insert(contacts)
      .values({ name, phone, lineId })
      .onConflictDoNothing()
      .returning({ id: contacts.id });
    if (created) return created.id;
    const [raced] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.phone, phone))
      .limit(1);
    return raced?.id ?? null;
  }

  // No phone to dedupe on: update the linked owner in place; create only if
  // the listing has none (a phoneless owner used to be re-inserted per save).
  if (currentOwnerId) {
    await db
      .update(contacts)
      .set({ name, lineId })
      .where(eq(contacts.id, currentOwnerId));
    return currentOwnerId;
  }
  const [created] = await db
    .insert(contacts)
    .values({ name, lineId })
    .returning({ id: contacts.id });
  return created.id;
}

async function parseListingForm(fd: FormData, viewer: Viewer) {
  // Sales can only file listings under their own name; other roles assign.
  const agentId =
    viewer.perms.listings === "all"
      ? (str(fd, "agentId") ?? viewer.userId)
      : viewer.userId;

  return {
    legacyCode: str(fd, "legacyCode"),
    listingName: str(fd, "listingName"),
    status:
      (await optionStr(fd, "status", "listing_status")) ?? "ข้อมูลยังไม่ครบ",
    potential: await optionStr(fd, "potential", "listing_potential"),
    listingType: await optionStr(fd, "listingType", "listing_type"),
    agentId,
    zoneId: str(fd, "zoneId"),
    projectId: str(fd, "projectId"),
    listedAt: dateStr(fd, "listedAt"),
    postedAt: dateStr(fd, "postedAt"),
    closedAt: dateStr(fd, "closedAt"),
    propertyType: await optionStr(fd, "propertyType", "property_type"),
    inProject: bool(fd, "inProject"),
    streetSoi: str(fd, "streetSoi"),
    locationGrade: await optionStr(fd, "locationGrade", "location_grade"),
    btsStationId: str(fd, "btsStationId"),
    mrtStationId: str(fd, "mrtStationId"),
    arlStationId: str(fd, "arlStationId"),
    unitTypeName: str(fd, "unitTypeName"),
    unitNo: str(fd, "unitNo"),
    bed: int(fd, "bed"),
    bath: int(fd, "bath"),
    maidRoom: int(fd, "maidRoom"),
    landRai: numStr(fd, "landRai"),
    landNgan: numStr(fd, "landNgan"),
    landWa: numStr(fd, "landWa"),
    usableSqm: numStr(fd, "usableSqm"),
    floor: str(fd, "floor"),
    building: str(fd, "building"),
    view: str(fd, "view"),
    direction: await optionStr(fd, "direction", "direction"),
    position: await optionStr(fd, "position", "unit_position"),
    parking: str(fd, "parking"),
    unitCondition: await optionStr(fd, "unitCondition", "unit_condition"),
    askingPrice: numStr(fd, "askingPrice"),
    rentalPrice: numStr(fd, "rentalPrice"),
    priceRemark: await optionStr(fd, "priceRemark", "price_remark"),
    postRemark: str(fd, "postRemark"),
    remarkCream: str(fd, "remarkCream"),
    googleMapsLink: str(fd, "googleMapsLink"),
  };
}


/**
 * Write the field-level audit trail for a direct edit, and hand a status
 * change off to listing support when it takes the unit off the portals.
 *
 * EXTRACTED FROM updateListing (2026-09-11) so the one-tap PillSelect in the
 * drawer goes through the same door. A status set from the drawer has exactly
 * the consequences a status set from the edit form does — it is the same
 * column with the same portal obligations — and a second write path that
 * skipped this would quietly drop listings off DDproperty with nothing in
 * support's queue saying so.
 *
 * `written` is the values actually written to the row, not raw form input, so
 * the diff records what changed rather than what was submitted.
 */

export async function createListing(fd: FormData) {
  const viewer = await getViewer();
  if (!canCreate(viewer.perms, "listings")) redirect("/");
  const values = await parseListingForm(fd, viewer);
  const ownerId = await resolveOwnerId(fd, null, viewer);
  const aiJobId = int(fd, "aiJobId");

  const [created] = await getDb()
    .insert(listings)
    .values({ ...values, ownerId, listedAt: values.listedAt ?? bkkToday() })
    .returning({ id: listings.id });

  if (aiJobId) await closeJob(aiJobId, "saved");
  revalidatePath("/listings");
  redirect(`/listings/${created.id}`);
}

export async function updateListing(id: string, fd: FormData) {
  const viewer = await getViewer();
  const db = getDb();

  const [current] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, id), listingScope(viewer)))
    .limit(1);
  if (!current) redirect("/listings");

  const values = await parseListingForm(fd, viewer);

  // Zone scope lets sales open a zone-mate's listing, but saving must not
  // reassign it to the editor — only assigning roles may change the agent
  // (current.agentId stays, including null on unassigned imported rows).
  const agentId: string | null =
    viewer.perms.listings === "all" ? values.agentId : current.agentId;

  // Same rule for the embedded owner: if the viewer can't see the owner,
  // the form posted blanks and the hidden owner must pass through untouched.
  const ownerId = canSeeOwnerOn(viewer, current.agentId)
    ? await resolveOwnerId(fd, current.ownerId, viewer)
    : current.ownerId;

  const written = { ...values, agentId };
  await db
    .update(listings)
    .set({ ...written, ownerId })
    .where(and(eq(listings.id, id), listingScope(viewer)));

  // Field-level audit trail + the portal-sync handoff a status change owes
  // support. Shared with setListingField below — see auditListingEdit.
  await auditListingEdit(id, current, written, viewer);

  revalidatePath(`/listings/${id}`);
  revalidatePath("/listings");
  redirect(`/listings/${id}`);
}

/** The two columns the drawer's PillSelect can set, and the options kind each
 *  is validated against. A closed map, not a parameter: this action takes its
 *  field name straight off a client call, and anything wider would be a
 *  column-name injection into the UPDATE below. */
const ONE_TAP_FIELDS = {
  status: "listing_status",
  potential: "listing_potential",
} as const;

/**
 * One-tap สถานะ / เกรด from the drawer (Ben, 2026-09-11). Same column, same
 * scope check and same audit + portal handoff as the edit form — it only
 * skips the form.
 *
 * Refusals are silent: an out-of-scope listing updates nothing because
 * listingScope is in the WHERE, and the drawer re-renders unchanged. That is
 * the same outcome the edit page gives, without the round trip.
 */
export async function setListingField(
  id: string,
  field: keyof typeof ONE_TAP_FIELDS,
  value: string
) {
  const kind = ONE_TAP_FIELDS[field];
  if (!kind) return;

  const viewer = await getViewer();
  const db = getDb();

  // Archived keys included: a listing sitting on a retired status must still
  // be settable back to it, and optionsFor() has already dropped it from the
  // pills the drawer offers.
  if (!(await allKeys(kind)).includes(value)) return;

  const [current] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, id), listingScope(viewer)))
    .limit(1);
  if (!current) return;

  const written = { [field]: value };
  await db
    .update(listings)
    .set(written)
    .where(and(eq(listings.id, id), listingScope(viewer)));

  await auditListingEdit(id, current, written, viewer);

  revalidatePath(`/listings/${id}`);
  revalidatePath("/listings");
}

/* markListingFollowed lived here until 2026-08-30 — see the note in the
   leads twin. The listing had no activity log at all, so owner work was
   invisible unless somebody planned it as a task; it has one now. */

/** Upsert one marketing channel row (unique per listing × channel). */
export async function saveListingChannel(listingId: string, fd: FormData) {
  const viewer = await getViewer();
  const db = getDb();

  // Channel edits require the listing to be in scope.
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.id, listingId), listingScope(viewer)))
    .limit(1);
  if (!row) redirect("/listings");

  const channel = await optionStr(fd, "channel", "listing_channel");
  if (!channel) redirect(`/listings/${listingId}`);

  // Only the fields the detail-page channel form actually posts. Columns the
  // form doesn't render (marketingReportLink, facebookAdDoc) must stay OUT of
  // the SET, or every save would null imported values.
  const values = {
    url: str(fd, "url"),
    boosted: bool(fd, "boosted"),
    lastPushedAt: dateStr(fd, "lastPushedAt"),
  };
  await db
    .insert(listingChannels)
    .values({ listingId, channel, ...values })
    .onConflictDoUpdate({
      target: [listingChannels.listingId, listingChannels.channel],
      set: values,
    });

  revalidatePath(`/listings/${listingId}`);
}

/* ── Media (R2) ─────────────────────────────────────────────────────── */

const MEDIA_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "application/pdf": ".pdf",
};

/** Upload one file into the listing's R2 gallery. */
export async function uploadListingMedia(listingId: string, fd: FormData) {
  const viewer = await getViewer();
  const db = getDb();
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.id, listingId), listingScope(viewer)))
    .limit(1);
  if (!row) redirect("/listings");

  const kind = enumStr(fd, "kind", mediaKind.enumValues);
  const file = fd.get("file");
  if (!kind || !(file instanceof File) || file.size === 0) {
    redirect(`/listings/${listingId}`);
  }
  const ext = MEDIA_EXT[file.type];
  if (!ext) redirect(`/listings/${listingId}`); // unsupported type

  const key = `listings/${listingId}/${kind}/${Date.now()}${ext}`;
  await putMedia(key, await file.arrayBuffer(), file.type);

  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${listingMedia.sortOrder}), -1)` })
    .from(listingMedia)
    .where(and(eq(listingMedia.listingId, listingId), eq(listingMedia.kind, kind)));
  await db.insert(listingMedia).values({
    listingId,
    kind,
    r2Key: key,
    sortOrder: Number(maxOrder) + 1,
  });
  revalidatePath(`/listings/${listingId}`);
}

/** Remove a gallery item: R2 object + row. */
export async function deleteListingMedia(listingId: string, mediaId: string) {
  const viewer = await getViewer();
  const db = getDb();
  const [row] = await db
    .select({ r2Key: listingMedia.r2Key })
    .from(listingMedia)
    .innerJoin(listings, eq(listingMedia.listingId, listings.id))
    .where(
      and(
        eq(listingMedia.id, mediaId),
        eq(listingMedia.listingId, listingId),
        listingScope(viewer)
      )
    )
    .limit(1);
  if (!row) redirect(`/listings/${listingId}`);

  await deleteMedia(row.r2Key);
  await db.delete(listingMedia).where(eq(listingMedia.id, mediaId));
  revalidatePath(`/listings/${listingId}`);
}

/* ── โฟกัสเจ้าของ ─────────────────────────────────────────────────────────── */

/**
 * Star / unstar a listing on the CALLER's own focus board.
 *
 * No user id in the signature, deliberately: toggleFocus reads it from the
 * session, so there is no shape of this call that stars something for
 * somebody else. The listing is re-checked against listingScope inside, so a
 * forged id outside the caller's book is a no-op rather than a hole.
 *
 * Returns the state it ended in so the button can settle without a refetch;
 * null means the listing was not the caller's to star.
 */
export async function toggleListingFocus(
  listingId: string
): Promise<boolean | null> {
  const viewer = await getViewer();
  const now = await toggleFocus(viewer, listingId);
  if (now === null) return null;
  revalidatePath("/owner-focus");
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/listings");
  return now;
}
