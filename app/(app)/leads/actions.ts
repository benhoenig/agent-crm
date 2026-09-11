"use server";

// Lead mutations. Scope is enforced by putting leadScope(viewer) in every
// UPDATE's WHERE — a request for a row outside the viewer's scope updates
// nothing. Leads have no audit table; edits apply directly.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contacts, leads, listings, pipelineStage, shareListings, shares } from "@/lib/db/schema";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { leadScope, listingScope } from "@/lib/repo/scope";
import {
  shareableListings,
  type ShareableListingPage,
} from "@/lib/repo/leads";
import { dateStr, int, numStr, reqStr, str } from "@/lib/forms";
import { allKeys, optionStr } from "@/lib/repo/options";
import { closeJob } from "@/lib/ai/jobs";
import { bkkToday } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { notifyUsers } from "@/lib/notify";
import { phoneTakenBy, resolvePickedContact } from "@/lib/repo/contacts";

/** Find-or-create the buyer contact from the intake form, deduped by phone
 *  (mirrors resolveOwnerId in the listings actions and the import rule). */
async function resolveContactId(fd: FormData, viewer: Viewer): Promise<string> {
  const db = getDb();
  const name = reqStr(fd, "contactName");
  // canonical digits-only form — THE dedupe key shared with the import
  const phone = normalizePhone(str(fd, "contactPhone"));
  const lineId = str(fd, "contactLineId");
  const email = str(fd, "contactEmail");

  // An explicit pick beats the phone guess — see resolveOwnerId in the
  // listings actions for the full argument; this is the same rule.
  const picked = await resolvePickedContact(viewer, str(fd, "contactId"));
  if (picked) {
    if (picked.editable) {
      // Same rule as resolveOwnerId: never write a number another contact
      // already holds (0024). The pick is the clearer intent.
      const free = phone ? !(await phoneTakenBy(phone, picked.id)) : false;
      await db
        .update(contacts)
        .set({ name, lineId, email, ...(free ? { phone } : {}) })
        .where(eq(contacts.id, picked.id));
    }
    return picked.id;
  }

  if (phone) {
    const [existing] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.phone, phone))
      .limit(1);
    if (existing) {
      await db
        .update(contacts)
        .set({
          name,
          ...(lineId ? { lineId } : {}),
          ...(email ? { email } : {}),
        })
        .where(eq(contacts.id, existing.id));
      return existing.id;
    }
  }
  // onConflictDoNothing for the same race as resolveOwnerId's insert.
  const [created] = await db
    .insert(contacts)
    .values({ name, phone, lineId, email })
    .onConflictDoNothing()
    .returning({ id: contacts.id });
  if (created) return created.id;
  const [raced] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.phone, phone!))
    .limit(1);
  return raced.id;
}

async function parseLeadFields(fd: FormData) {
  return {
    listingId: str(fd, "listingId"),
    initialInterest: str(fd, "initialInterest"),
    leadType: await optionStr(fd, "leadType", "lead_type"),
    source: await optionStr(fd, "source", "marketing_channel"),
    contactBy: await optionStr(fd, "contactBy", "contact_by"),
    potential: await optionStr(fd, "potential", "lead_potential"),
    budgetMillion: numStr(fd, "budgetMillion"),
    timeline: str(fd, "timeline"),
    background: str(fd, "background"),
    requirement: str(fd, "requirement"),
    painPoint: str(fd, "painPoint"),
  };
}

export async function createLead(fd: FormData) {
  const viewer = await getViewer();
  // leadCreate, not canCreate(leads): the scope says which leads you may
  // SEE, and sales must keep theirs. Opening a new one is the intake
  // desk's act (Ben, 2026-09-11). This is the real gate — the hidden
  // button and the guarded routes below it are courtesy, not security.
  if (!viewer.perms.leadCreate) redirect("/leads");
  const contactId = await resolveContactId(fd, viewer);
  const fields = await parseLeadFields(fd);

  // Sales file leads under their own name. Intake roles choose: hand it to an
  // agent now, or leave it NULL and let it sit in the waiting list to be
  // triaged later (Ben, 2026-08-25 — "it can be both"). str() gives null for
  // the empty option, which is exactly the unassigned case.
  const assignedTo = viewer.perms.intakeAssign
    ? str(fd, "assignedTo")
    : viewer.userId;

  const [created] = await getDb()
    .insert(leads)
    .values({
      ...fields,
      potential: fields.potential ?? "New Lead",
      contactId,
      assignedTo,
      createdBy: viewer.userId,
      submittedAt: new Date(),
    })
    .returning({ id: leads.id });

  if (assignedTo && assignedTo !== viewer.userId) {
    await notifyUsers([assignedTo], {
      type: "lead_assigned",
      title: `Lead ใหม่มอบหมายให้คุณ`,
      body: `${fields.initialInterest ?? "ไม่ระบุทรัพย์"} · โดย ${viewer.name}`,
      link: `/leads/${created.id}`,
    });
  }

  const aiJobId = int(fd, "aiJobId");
  if (aiJobId) await closeJob(aiJobId, "saved");
  revalidatePath("/leads");
  redirect(`/leads/${created.id}`);
}

export async function updateLead(id: string, fd: FormData) {
  const viewer = await getViewer();
  const db = getDb();

  const [current] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), leadScope(viewer)))
    .limit(1);
  if (!current) redirect("/leads");

  // Contact fields apply to the linked contact row; create one if missing.
  // Contacts are deduped by phone, so one row can back several leads across
  // agents: write only fields the form posted NON-EMPTY. A cleared input
  // must not null a shared buyer's data (or destroy the phone dedupe key)
  // out from under every other lead — clearing happens on the contact
  // itself once a contacts admin surface exists, not via a lead edit.
  const postedName = str(fd, "contactName");
  // normalize to the shared dedupe format; a value that isn't a phone at
  // all normalizes to null and is filtered out (never clobber a shared key)
  const postedPhone = normalizePhone(str(fd, "contactPhone"));
  const postedLineId = str(fd, "contactLineId");
  const postedEmail = str(fd, "contactEmail");

  const posted = Object.entries({
    name: postedName,
    phone: postedPhone,
    lineId: postedLineId,
    email: postedEmail,
  }).filter(([, v]) => v !== null);

  let contactId = current.contactId;

  // A pick short-circuits the phone-relink dance below: the user chose this
  // person by name from a list, which is a better answer than any inference
  // from the number they happened to type.
  const picked = await resolvePickedContact(viewer, str(fd, "contactId"));

  // Phone is THE dedupe key (lib/phone.ts, shared with the import), and
  // resolveContactId resolves it first-match-wins. Writing a phone that
  // already belongs to ANOTHER contact straight onto this row would leave two
  // contacts sharing that key and make future lookups arbitrary — so relink
  // this lead to the existing contact instead, filling only its blanks
  // (same shared-row rule as contacts: never overwrite another agent's data).
  let relinked = false;
  if (picked) {
    contactId = picked.id;
    relinked = true;
    if (picked.editable && posted.length) {
      await db
        .update(contacts)
        .set(Object.fromEntries(posted))
        .where(eq(contacts.id, picked.id));
    }
  } else if (postedPhone) {
    const [byPhone] = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        lineId: contacts.lineId,
        email: contacts.email,
      })
      .from(contacts)
      .where(eq(contacts.phone, postedPhone))
      .limit(1);

    if (byPhone && byPhone.id !== contactId) {
      const fill = {
        ...(!byPhone.name && postedName ? { name: postedName } : {}),
        ...(!byPhone.lineId && postedLineId ? { lineId: postedLineId } : {}),
        ...(!byPhone.email && postedEmail ? { email: postedEmail } : {}),
      };
      if (Object.keys(fill).length) {
        await db.update(contacts).set(fill).where(eq(contacts.id, byPhone.id));
      }
      contactId = byPhone.id;
      relinked = true;
    }
  }

  if (!relinked) {
    if (contactId) {
      if (posted.length) {
        await db
          .update(contacts)
          .set(Object.fromEntries(posted))
          .where(eq(contacts.id, contactId));
      }
    } else if (posted.length) {
      const [createdContact] = await db
        .insert(contacts)
        .values(Object.fromEntries(posted))
        .returning({ id: contacts.id });
      contactId = createdContact.id;
    }
  }

  const fields = await parseLeadFields(fd);
  // Same rule on edit, which also lets intake push a lead BACK to the pool.
  const assignedTo = viewer.perms.intakeAssign
    ? str(fd, "assignedTo")
    : current.assignedTo;

  await db
    .update(leads)
    .set({ ...fields, contactId, assignedTo })
    .where(and(eq(leads.id, id), leadScope(viewer)));

  // Reassignment pings the new assignee (not the actor, not on no-change).
  if (
    assignedTo &&
    assignedTo !== current.assignedTo &&
    assignedTo !== viewer.userId
  ) {
    await notifyUsers([assignedTo], {
      type: "lead_assigned",
      title: `Lead มอบหมายให้คุณ`,
      body: `${fields.initialInterest ?? current.initialInterest ?? "ไม่ระบุทรัพย์"} · โดย ${viewer.name}`,
      link: `/leads/${id}`,
    });
  }

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  redirect(`/leads/${id}`);
}

/* markLeadFollowed lived here until 2026-08-30. It set last_followed_at and
   wrote no activity row, so a lead could leave the overdue queue with nothing
   on its record saying what was done — the drift the whole activity log
   exists to prevent. Writing an entry is the follow now; the stamp is derived
   from the newest countable entry (app/(app)/activity-actions.ts). */

/** Stage stepper — moving a stage counts as a follow. "Win" is just a stage. */
export async function setLeadStage(id: string, stage: string) {
  const viewer = await getViewer();
  if (!(pipelineStage.enumValues as readonly string[]).includes(stage)) return;
  await getDb()
    .update(leads)
    .set({
      pipelineStage: stage as (typeof pipelineStage.enumValues)[number],
      lastFollowedAt: bkkToday(),
    })
    .where(and(eq(leads.id, id), leadScope(viewer)));
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

/** The two columns the drawer's PillSelect can set, and the options kind each
 *  is validated against. A closed map, not a parameter — the field name comes
 *  off a client call and anything wider would be a column name injected into
 *  the UPDATE. Mirrors ONE_TAP_FIELDS in the listings twin. */
const ONE_TAP_FIELDS = {
  leadStatus: "lead_status",
  potential: "lead_potential",
} as const;

/**
 * One-tap สถานะ / เกรด from the drawer (Ben, 2026-09-11). The lead twin of
 * setListingField — simpler, because leads have no audit table and no portal
 * obligation; the scope check is the whole of it.
 *
 * DOES NOT TOUCH lastFollowedAt, unlike setLeadStage. Moving a lead down the
 * funnel is work and stamps the SLA clock; relabelling its grade is not, and
 * stamping it here would let an overdue lead be made current by tapping a
 * pill — the exact hole the "Follow วันนี้" button was removed for (0830).
 */
export async function setLeadField(
  id: string,
  field: keyof typeof ONE_TAP_FIELDS,
  value: string
) {
  const kind = ONE_TAP_FIELDS[field];
  if (!kind) return;

  const viewer = await getViewer();
  // Archived keys included: a lead sitting on a retired status must still be
  // settable back to it. optionsFor() already keeps those out of the pills.
  if (!(await allKeys(kind)).includes(value)) return;

  await getDb()
    .update(leads)
    .set({ [field]: value })
    .where(and(eq(leads.id, id), leadScope(viewer)));

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

/** ปิดเคส card — closing facts + case/lead status. */
export async function saveClosing(id: string, fd: FormData) {
  const viewer = await getViewer();
  const newLeadStatus = await optionStr(fd, "leadStatus", "lead_status");
  await getDb()
    .update(leads)
    .set({
      commission: numStr(fd, "commission"),
      bankLoan: str(fd, "bankLoan"),
      closingUnit: str(fd, "closingUnit"),
      closingDate: dateStr(fd, "closingDate"),
      transferDate: dateStr(fd, "transferDate"),
      closingRemark: str(fd, "closingRemark"),
      caseStatus: await optionStr(fd, "caseStatus", "case_status"),
      // leadStatus is NOT NULL — only overwrite when the select sent a value.
      ...(newLeadStatus ? { leadStatus: newLeadStatus } : {}),
    })
    .where(and(eq(leads.id, id), leadScope(viewer)));
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

export async function saveComplain(id: string, fd: FormData) {
  const viewer = await getViewer();
  await getDb()
    .update(leads)
    .set({
      complain: str(fd, "complain"),
      complainSeverity: await optionStr(fd, "severity", "complain_severity"),
      complainStatus: await optionStr(fd, "status", "complain_status"),
    })
    .where(and(eq(leads.id, id), leadScope(viewer)));
  revalidatePath(`/leads/${id}`);
}

/* logLeadAction lived here too, and was the lead's half of the same job.
   Both sides now share one implementation in activity-actions.ts, because
   keeping the SLA recompute in two files is exactly how they came to
   disagree. */

/* ── buyer share rooms ─────────────────────────────────────────────── */

/** Create a share room: an unguessable /share/{token} link carrying the
    picked listings. The lead must be in the viewer's scope; each picked
    listing must be in listingScope too — a share must never widen what its
    creator could see. */
export async function createShare(leadId: string, fd: FormData) {
  const viewer = await getViewer();
  const db = getDb();

  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), leadScope(viewer)))
    .limit(1);
  if (!lead) redirect("/leads");

  const pickedIds = fd
    .getAll("listingIds")
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  if (!pickedIds.length) redirect(`/leads/${leadId}`);

  // scope-check the picked listings; out-of-scope ids are silently dropped
  const allowed = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(inArray(listings.id, pickedIds), listingScope(viewer)));
  if (!allowed.length) redirect(`/leads/${leadId}`);

  const token = crypto.randomUUID().replace(/-/g, "");
  const [share] = await db
    .insert(shares)
    .values({ token, leadId, createdBy: viewer.userId })
    .returning({ id: shares.id });
  await db.insert(shareListings).values(
    allowed.map((l, i) => ({
      shareId: share.id,
      listingId: l.id,
      sortOrder: i,
    }))
  );

  revalidatePath(`/leads/${leadId}`);
}

/** Close the door. The row and its feedback history stay. */
export async function revokeShare(leadId: string, shareId: string) {
  const viewer = await getViewer();
  const db = getDb();
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), leadScope(viewer)))
    .limit(1);
  if (!lead) redirect("/leads");

  await db
    .update(shares)
    .set({ revokedAt: new Date() })
    .where(and(eq(shares.id, shareId), eq(shares.leadId, leadId)));
  revalidatePath(`/leads/${leadId}`);
}

/**
 * Hand one waiting-list lead to an agent — the one-click half of triage, so
 * assigning from the dashboard queue does not mean opening the edit form.
 * Gated on intakeAssign (admin), the same permission the form field is.
 */
export async function assignLead(id: string, fd: FormData) {
  const viewer = await getViewer();
  if (!viewer.perms.intakeAssign) return;
  const agentId = str(fd, "agentId");
  if (!agentId) return;

  await getDb()
    .update(leads)
    .set({ assignedTo: agentId })
    .where(and(eq(leads.id, id), leadScope(viewer)));

  revalidatePath("/");
  revalidatePath("/leads");
}

/* ── share picker lookup ───────────────────────────────────────────── */

/**
 * Typeahead behind ส่งทรัพย์ให้ลูกค้า. The scope and status rules live in
 * shareableListings (lib/repo/leads.ts); this is only the door a client
 * component can knock on, exactly as lookupContacts is for the ContactPicker.
 *
 * READ-ONLY AND DELIBERATELY UNGATED BEYOND THE SESSION. It returns nothing a
 * viewer could not already reach by opening /listings — same listingScope,
 * same four searched columns — and createShare re-checks every picked id
 * against that scope before writing, so a forged call here buys nothing.
 */
export async function lookupShareableListings(
  q: string
): Promise<ShareableListingPage> {
  const viewer = await getViewer();
  // No caller-supplied limit: the repo's SHARE_PICKER_LIMIT is the one
  // number, so the "showing the first N" line can never quote a different
  // one from the query that produced it.
  return shareableListings(viewer, { q });
}
