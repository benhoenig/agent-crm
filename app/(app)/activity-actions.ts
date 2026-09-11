"use server";

/* The record's activity log — writes.

   ONE FILE FOR BOTH SIDES, because a lead entry and a listing entry are the
   same row in the same table and differ only by which id they carry. Splitting
   them across leads/actions.ts and listings/actions.ts would mean maintaining
   the SLA recompute twice, and the whole reason this exists is that the two
   used to disagree.

   WHAT REPLACED WHAT (Ben, 2026-08-30). `markLeadFollowed` and
   `markListingFollowed` stamped last_followed_at and wrote nothing else, so a
   record could go from overdue to current with no trace of what was done. Here
   the entry is the record and the stamp is derived from it: post something,
   and the clock moves because there is now something to point at.

   THE CLOCK IS RECOMPUTED, NEVER NUDGED. Every write ends by asking the table
   for the newest countable entry and writing that date. Withdrawing the most
   recent follow has to fall back to the one before it, and there is no
   arithmetic that does that — only a re-read. */

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { actions, leads, listings } from "@/lib/db/schema";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { notifyUsers } from "@/lib/notify";
import { leadScope } from "@/lib/repo/scope";
import { listingScope } from "@/lib/repo/scope";
import { bkkToday } from "@/lib/format";
import {
  categoryAllowed,
  lastCountedDate,
  type ActivitySide,
} from "@/lib/repo/activities";

/** Can the viewer see — and therefore write on — this record? The log has no
    permission of its own: if the record is in your book you may write on its
    history, and if it is not you cannot even read it.

    RETURNS WHO OWNS THE RECORD TOO, read in the same statement that already
    had to run. logActivity needs it to tell that person something was written
    on their listing, and a second query for a column this one is already
    standing on would be a round trip bought for nothing. */
async function assertRecord(
  side: ActivitySide,
  id: string
): Promise<{ viewer: Viewer; ownerId: string | null; label: string }> {
  const viewer = await getViewer();
  const db = getDb();
  if (side === "lead") {
    const [row] = await db
      .select({
        ownerId: leads.assignedTo,
        interest: leads.initialInterest,
        code: leads.legacyCode,
      })
      .from(leads)
      .where(and(eq(leads.id, id), leadScope(viewer)))
      .limit(1);
    if (!row) throw new Error("ไม่พบรายการนี้");
    return {
      viewer,
      ownerId: row.ownerId,
      label: row.interest ?? row.code ?? "Lead",
    };
  }
  const [row] = await db
    .select({
      ownerId: listings.agentId,
      name: listings.listingName,
      code: listings.legacyCode,
    })
    .from(listings)
    .where(and(eq(listings.id, id), listingScope(viewer)))
    .limit(1);
  if (!row) throw new Error("ไม่พบรายการนี้");
  return {
    viewer,
    ownerId: row.ownerId,
    label: row.name ?? row.code ?? "ทรัพย์",
  };
}

/** Write the derived follow date back onto the record it belongs to. */
async function syncClock(side: ActivitySide, id: string) {
  const date = await lastCountedDate(side, id);
  const db = getDb();
  if (side === "lead") {
    await db.update(leads).set({ lastFollowedAt: date }).where(eq(leads.id, id));
  } else {
    await db
      .update(listings)
      .set({ lastFollowedAt: date })
      .where(eq(listings.id, id));
  }
}

function paths(side: ActivitySide, id: string) {
  revalidatePath(side === "lead" ? `/leads/${id}` : `/listings/${id}`);
  revalidatePath(side === "lead" ? "/leads" : "/listings");
  revalidatePath("/");
  revalidatePath("/today");
}

/** Post an entry.

    `kind` null is a plain note: it goes in the history, counts toward nothing
    and does NOT move the clock. That last part is the load-bearing bit — if a
    bare note reset the SLA, an overdue queue could be cleared by typing "." on
    every row, and the queue would stop meaning anything. */
export async function logActivity(
  side: ActivitySide,
  recordId: string,
  kind: string | null,
  note: string
) {
  const { viewer, ownerId, label } = await assertRecord(side, recordId);
  const userId = viewer.userId;
  const text = note.trim();
  if (!text) throw new Error("กรุณาพิมพ์รายละเอียด");

  // A kind belonging to the OTHER side is refused rather than silently
  // re-filed: an Owner Visit on a buyer is unrecoverable from the prose, and
  // it is wrong in the monthly count from the moment it is written.
  if (!(await categoryAllowed(side, kind))) {
    throw new Error("ประเภทงานนี้ใช้กับรายการนี้ไม่ได้");
  }

  await getDb()
    .insert(actions)
    .values({
      date: bkkToday(),
      agentId: userId,
      category: kind,
      remark: text,
      leadId: side === "lead" ? recordId : null,
      listingId: side === "listing" ? recordId : null,
    });

  await syncClock(side, recordId);
  paths(side, recordId);

  /* TELL THE PERSON WHOSE RECORD IT IS (Ben, 2026-09-11: support must be able
     to say "ข้อมูลไม่ครบ โพสต์ไม่ได้" and have it ARRIVE). Until now an entry
     written by anyone but the owner was silent — it sat on a page the owner
     had no reason to open, so the one message that exists to unblock work was
     the one nobody saw.

     ONLY WHEN SOMEBODY ELSE WROTE IT. Logging your own work on your own
     record is not news, and `ownerId !== userId` is the whole test — no role
     check, because the question is "is this about me" and not "what job does
     the author hold".

     AFTER the write and after the clock, never before: a notification that
     fails must not cost the entry it was announcing (lib/notify.ts swallows
     its own errors for the same reason). */
  if (ownerId && ownerId !== userId) {
    await notifyUsers([ownerId], {
      type: "activity_note",
      title: `${viewer.name} เขียนถึง ${label}`,
      // The note itself, trimmed to a glance. The link carries the rest.
      body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
      link: side === "lead" ? `/leads/${recordId}` : `/listings/${recordId}`,
    });
  }
}

/** The row, if the viewer may correct it. Own entries only — an activity is a
    claim about YOUR work, and editing someone else's is a different feature
    with a different conversation behind it. */
async function ownEntry(entryId: string) {
  const viewer = await getViewer();
  const [row] = await getDb()
    .select({
      id: actions.id,
      leadId: actions.leadId,
      listingId: actions.listingId,
    })
    .from(actions)
    .where(and(eq(actions.id, entryId), eq(actions.agentId, viewer.userId)))
    .limit(1);
  if (!row) throw new Error("ไม่พบรายการนี้");
  const side: ActivitySide | null = row.leadId
    ? "lead"
    : row.listingId
      ? "listing"
      : null;
  return { row, side };
}

/** Re-file a mis-tagged entry. The work happened; it was filed as the wrong
    thing. Null re-files it as a plain note, which takes it out of the counts
    and off the clock. */
export async function setActivityKind(entryId: string, kind: string | null) {
  const { row, side } = await ownEntry(entryId);
  // An entry with no record behind it came from the daily plan; its category
  // is the task's and is corrected there, not here.
  if (!side) throw new Error("รายการนี้แก้ประเภทจากแผนงาน");
  const recordId = (side === "lead" ? row.leadId : row.listingId)!;

  if (!(await categoryAllowed(side, kind))) {
    throw new Error("ประเภทงานนี้ใช้กับรายการนี้ไม่ได้");
  }

  await getDb()
    .update(actions)
    .set({ category: kind })
    .where(eq(actions.id, row.id));
  await syncClock(side, recordId);
  paths(side, recordId);
}

/** Withdraw an entry, or put it back.

    NOT A DELETE, on purpose. A monthly number that dropped needs a reason
    someone can point at, and a withdrawal made in error has to be reversible.
    The row keeps its place in the history with a line through it. */
export async function setActivityVoided(entryId: string, voided: boolean) {
  const { row, side } = await ownEntry(entryId);
  if (!side) throw new Error("รายการนี้ยกเลิกจากการ์ดกิจกรรมวันนี้");
  const recordId = (side === "lead" ? row.leadId : row.listingId)!;

  await getDb()
    .update(actions)
    .set({ voided })
    .where(eq(actions.id, row.id));
  await syncClock(side, recordId);
  paths(side, recordId);
}
