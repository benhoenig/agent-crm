"use server";

// PUBLIC actions — the buyer's สนใจ/ยังไม่ใช่ verdict. No session: the token
// is the authorisation, checked against a LIVE share on every call, and the
// only thing a caller can write is feedback on a listing that share already
// contains. Reasons are constrained to the fixed list; free text is capped.

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  contacts,
  leads,
  listings,
  shareFeedbackEvents,
  shareListings,
  shares,
} from "@/lib/db/schema";
import { notifyUsers } from "@/lib/notify";
import { REJECT_REASONS } from "@/lib/share-feedback";

export async function submitFeedback(
  token: string,
  listingId: string,
  fd: FormData
) {
  const db = getDb();
  const kind = fd.get("kind") === "interested" ? "interested" : "rejected";
  const reasons =
    kind === "rejected"
      ? (REJECT_REASONS as readonly string[]).filter(
          (r) => fd.get(`reason-${r}`) === "on"
        )
      : [];
  const note = String(fd.get("note") ?? "")
    .trim()
    .slice(0, 300);
  if (note) reasons.push(`หมายเหตุ: ${note}`);

  // The token must name a live share that contains this listing.
  const [row] = await db
    .select({ shareId: shares.id, leadId: shares.leadId, createdBy: shares.createdBy })
    .from(shares)
    .innerJoin(
      shareListings,
      and(
        eq(shareListings.shareId, shares.id),
        eq(shareListings.listingId, listingId)
      )
    )
    .where(and(eq(shares.token, token), isNull(shares.revokedAt)))
    .limit(1);
  if (!row) return;

  await db
    .update(shareListings)
    .set({ feedback: kind, feedbackReasons: reasons, feedbackAt: new Date() })
    .where(
      and(
        eq(shareListings.shareId, row.shareId),
        eq(shareListings.listingId, listingId)
      )
    );
  await db.insert(shareFeedbackEvents).values({
    shareId: row.shareId,
    listingId,
    kind,
    reasons,
  });

  // Tell the people working this buyer — the whole point of asking.
  try {
    const [[lead], [listing]] = await Promise.all([
      db
        .select({ assignedTo: leads.assignedTo, contactName: contacts.name })
        .from(leads)
        .leftJoin(contacts, eq(contacts.id, leads.contactId))
        .where(eq(leads.id, row.leadId))
        .limit(1),
      db
        .select({ name: listings.listingName, legacy: listings.legacyCode })
        .from(listings)
        .where(eq(listings.id, listingId))
        .limit(1),
    ]);
    const recipients = [lead?.assignedTo, row.createdBy].filter(
      (x): x is string => !!x
    );
    await notifyUsers(recipients, {
      type: "share_feedback",
      title:
        kind === "interested"
          ? `ลูกค้าสนใจ ${listing?.name ?? listing?.legacy ?? "ทรัพย์"}`
          : `ลูกค้าตอบ "ยังไม่ใช่" — ${listing?.name ?? listing?.legacy ?? "ทรัพย์"}`,
      body: [lead?.contactName, reasons.join(", ")].filter(Boolean).join(" · "),
      link: `/leads/${row.leadId}`,
    });
  } catch (err) {
    console.error("[share] feedback notify failed:", err);
  }

  revalidatePath(`/share/${token}`);
}
