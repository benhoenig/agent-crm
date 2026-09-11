"use server";

// Deal mutations. Scope is enforced by putting dealScope(viewer) in the
// UPDATE's WHERE — a request for a row outside the viewer's scope updates
// nothing. Support (deals: "none") is rejected before any query.
//
// Lead linking is intentionally absent from the form: historic deal ↔ lead
// links happen at the Phase-4 import; an in-app linker is a later
// enhancement.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealPayouts, deals } from "@/lib/db/schema";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { canCreate, canSeeDealPII, dealScope } from "@/lib/repo/scope";
import { bool, dateStr, numStr, str } from "@/lib/forms";
import { optionStr } from "@/lib/repo/options";
import { syncDealLedger } from "@/lib/repo/deal-ledger";
import { notifyPermission, notifyUsers } from "@/lib/notify";

async function parseDealForm(fd: FormData, viewer: Viewer) {
  // Sales can only file deals under their own name; admin/manager assign.
  const salesId =
    viewer.perms.deals === "all"
      ? (str(fd, "salesId") ?? viewer.userId)
      : viewer.userId;

  return {
    listingId: str(fd, "listingId"),
    type: str(fd, "type"), // free vocabulary from _raw_revenue ("Sale"/"Rent")
    closingPrice: numStr(fd, "closingPrice"),
    commission: numStr(fd, "commission"),
    reservationAmount: numStr(fd, "reservationAmount"),
    closingStatus: await optionStr(fd, "closingStatus", "closing_status"),
    receiveDate: dateStr(fd, "receiveDate"),
    closingDate: dateStr(fd, "closingDate"),
    transferDate: dateStr(fd, "transferDate"),
    salesId,
    coAgent: str(fd, "coAgent"),
    remark: str(fd, "remark"),
  };
}

function parseDealPII(fd: FormData) {
  return {
    buyerFullname: str(fd, "buyerFullname"),
    buyerAddress: str(fd, "buyerAddress"),
    buyerIdNo: str(fd, "buyerIdNo"),
    sellerFullname: str(fd, "sellerFullname"),
    sellerAddress: str(fd, "sellerAddress"),
    sellerIdNo: str(fd, "sellerIdNo"),
  };
}

export async function createDeal(fd: FormData) {
  const viewer = await getViewer();
  if (!canCreate(viewer.perms, "deals")) redirect("/");

  const values = await parseDealForm(fd, viewer);
  // Only admin forms carry PII fields; everyone else inserts none.
  const pii = canSeeDealPII(viewer) ? parseDealPII(fd) : {};

  const [created] = await getDb()
    .insert(deals)
    .values({ ...values, ...pii })
    .returning({ id: deals.id });

  await syncDealLedger(created.id);
  await notifyDealSubmitted(created.id, viewer.userId);
  revalidatePath("/"); // the ดีลปิด dashboard tab
  revalidatePath("/deal-review"); // บัญชี's queue — a deal changes its place in it
  revalidatePath("/ledger");
  redirect(`/deals/${created.id}`);
}

export async function updateDeal(id: string, fd: FormData) {
  const viewer = await getViewer();
  if (!canCreate(viewer.perms, "deals")) redirect("/");
  const db = getDb();

  const [existing] = await db
    .select({ id: deals.id, reviewedAt: deals.reviewedAt })
    .from(deals)
    .where(and(eq(deals.id, id), dealScope(viewer)))
    .limit(1);
  if (!existing) redirect("/?tab=deals");
  // A reviewed deal is FROZEN — refusing the edit (rather than allowing it
  // for reviewers) is what makes "ตรวจแล้ว" mean the numbers have not moved.
  if (existing.reviewedAt) redirect(`/deals/${id}`);

  const values = await parseDealForm(fd, viewer);
  // Non-admins never see the PII fields, so their form posts none — OMIT the
  // PII columns from SET entirely. Spreading nulls here would let a manager
  // saving the form silently wipe admin-scoped buyer/seller identity.
  const pii = canSeeDealPII(viewer) ? parseDealPII(fd) : {};

  await db
    .update(deals)
    .set({ ...values, ...pii })
    .where(and(eq(deals.id, id), dealScope(viewer)));

  // Re-run on every edit, not just the one that first sets a price: a
  // corrected commission has to reach the books, and a deal turned dead has
  // to withdraw its rows.
  await syncDealLedger(id);
  await notifyDealSubmitted(id, viewer.userId);
  revalidatePath(`/deals/${id}`);
  revalidatePath("/"); // the ดีลปิด dashboard tab
  revalidatePath("/deal-review"); // บัญชี's queue — a deal changes its place in it
  revalidatePath("/ledger");
  redirect(`/deals/${id}`);
}

/* ── payout splits ─────────────────────────────────────────────────── */

/** Replace the payout legs — whole-set semantics in ONE statement (no
    interactive transactions on Neon HTTP; a half-applied split is a wrong
    number on screen). Rows come indexed from the form: payout-role-0,
    payout-payee-0, … an empty role means the row was cleared. */
export async function setDealPayouts(id: string, fd: FormData) {
  const viewer = await getViewer();
  if (!canCreate(viewer.perms, "deals")) redirect("/");
  const db = getDb();

  const [existing] = await db
    .select({ id: deals.id, reviewedAt: deals.reviewedAt })
    .from(deals)
    .where(and(eq(deals.id, id), dealScope(viewer)))
    .limit(1);
  if (!existing) redirect("/?tab=deals");
  if (existing.reviewedAt) redirect(`/deals/${id}`);

  const legs: {
    role: string;
    payeeName: string | null;
    pct: number | null;
    amount: string | null;
    paid: boolean;
    paidDate: string | null;
  }[] = [];
  for (let i = 0; i < 10; i++) {
    const role = await optionStr(fd, `payout-role-${i}`, "payout_role");
    if (!role) continue;
    const pctRaw = numStr(fd, `payout-pct-${i}`);
    legs.push({
      role,
      payeeName: str(fd, `payout-payee-${i}`),
      pct: pctRaw === null ? null : Number(pctRaw),
      amount: numStr(fd, `payout-amount-${i}`),
      paid: bool(fd, `payout-paid-${i}`),
      paidDate: dateStr(fd, `payout-paiddate-${i}`),
    });
  }

  if (!legs.length) {
    await db.delete(dealPayouts).where(eq(dealPayouts.dealId, id));
  } else {
    const values = legs.map(
      (r) =>
        sql`(${id}::uuid, ${r.role}, ${r.payeeName}, ${r.pct}, ${r.amount}, ${r.paid}, ${r.paidDate}::date)`
    );
    await db.execute(sql`
      WITH cleared AS (
        DELETE FROM ${dealPayouts} WHERE "deal_id" = ${id}::uuid
      )
      INSERT INTO ${dealPayouts} ("deal_id","role","payee_name","pct","amount","paid","paid_date")
      VALUES ${sql.join(values, sql`, `)}
    `);
  }

  // Ticking a split "paid" IS the withdrawal — the books must hear about it.
  await syncDealLedger(id);
  revalidatePath(`/deals/${id}`);
  revalidatePath("/ledger");
  redirect(`/deals/${id}`);
}

/* ── the review loop ───────────────────────────────────────────────── */

async function dealLabel(id: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ legacy: deals.legacyCode, commission: deals.commission })
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  if (!row) return "ดีล";
  return [row.legacy ?? "ดีล", row.commission ? `คอม ฿${Number(row.commission).toLocaleString("th-TH")}` : null]
    .filter(Boolean)
    .join(" · ");
}

/** "There are numbers waiting on you" — to everyone who can sign off. */
async function notifyDealSubmitted(id: string, actorId: string) {
  await notifyPermission(
    (p) => p.dealReview,
    {
      type: "deal_submitted",
      title: "มีดีลรอตรวจ",
      body: await dealLabel(id),
      link: `/deals/${id}`,
    },
    actorId
  );
}

/** Sign off. Stamps who and when; the deal locks. */
export async function reviewDeal(id: string) {
  const viewer = await getViewer();
  if (!viewer.perms.dealReview) redirect(`/deals/${id}`);
  const db = getDb();
  const [row] = await db
    .select({ salesId: deals.salesId })
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  if (!row) redirect("/?tab=deals");

  await db
    .update(deals)
    .set({ reviewedBy: viewer.userId, reviewedAt: new Date() })
    .where(eq(deals.id, id));
  if (row.salesId && row.salesId !== viewer.userId) {
    await notifyUsers([row.salesId], {
      type: "deal_reviewed",
      title: "ดีลผ่านการตรวจแล้ว",
      body: await dealLabel(id),
      link: `/deals/${id}`,
    });
  }
  revalidatePath(`/deals/${id}`);
  revalidatePath("/"); // the ดีลปิด dashboard tab
  revalidatePath("/deal-review"); // บัญชี's queue — a deal changes its place in it
}

/** Reopen for correction — the reviewer's call; clears the stamp rather than
    keeping a sign-off that no longer describes the numbers. */
export async function reopenDeal(id: string) {
  const viewer = await getViewer();
  if (!viewer.perms.dealReview) redirect(`/deals/${id}`);
  const db = getDb();
  const [row] = await db
    .select({ salesId: deals.salesId })
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  if (!row) redirect("/?tab=deals");

  await db
    .update(deals)
    .set({ reviewedBy: null, reviewedAt: null })
    .where(eq(deals.id, id));
  if (row.salesId && row.salesId !== viewer.userId) {
    await notifyUsers([row.salesId], {
      type: "deal_reopened",
      title: "ดีลถูกเปิดแก้ไข",
      body: await dealLabel(id),
      link: `/deals/${id}`,
    });
  }
  revalidatePath(`/deals/${id}`);
  revalidatePath("/"); // the ดีลปิด dashboard tab
  revalidatePath("/deal-review"); // บัญชี's queue — a deal changes its place in it
}
