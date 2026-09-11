/* A commission that arrived is a deposit in the bank — the deal posts its own
   ledger rows (ported from the Klaichan/Mook CRM, where typing each one twice
   put the running balance ฿121,350 out before anyone noticed).

   WHAT POSTS, AND WHEN:
     - Revenue posts on `receive_date` — when the commission ARRIVED, not the
       closing date. A deal closed in March and paid in June is June's money.
     - A payout leg posts only when marked `paid`, dated `paid_date`. An owed
       split is a promise, and promises do not move a balance.
     - A deal whose closing_status carries role `dead` (or that loses its
       commission/receive date) withdraws its rows — archived, not deleted,
       because someone may have reconciled against them.

   WHO OWNS WHAT: the DEAL owns amount, date and direction, and re-syncs on
   every edit so a corrected commission cannot leave a stale number in the
   books. Category, receipt flag, files, remark AND WHICH ACCOUNT belong to the
   bookkeeper and are only set at creation. A hand-archived row is never
   re-posted.

   THE ACCOUNT IS A GUESS, AND ONLY AT CREATION (2026-09-11). A deal knows a
   commission arrived; it does not know which bank account it landed in. So a
   posted row opens in the default account and the bookkeeper moves it if that
   was wrong — and a later re-sync must never drag it back, which is why
   accountId sits on the creation side of the ownership line above rather than
   being rewritten with the amount.

   POSTING TARGETS come from the options catalog by ROLE, not by key —
   `commission_income` and `commission_split` on kind ledger_category — and a
   payout leg posts to its payout_role's linkedKey category when that
   resolves. The client can rename every line without moving a satang. */

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealPayouts, deals, listings, transactions } from "@/lib/db/schema";
import { allOptions, roleKeys } from "./options";
import { defaultAccountId } from "./ledger-accounts";
import { bahtStrToSatang } from "@/lib/ledger";

export type LedgerSyncResult = "created" | "updated" | "withdrawn" | "skipped";

/** Bring one deal's ledger rows in line with the deal. Safe to call on every
    deal write. */
export async function syncDealLedger(dealId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ d: deals, listingName: listings.listingName, legacy: listings.legacyCode })
    .from(deals)
    .leftJoin(listings, eq(listings.id, deals.listingId))
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!row) return;
  const { d } = row;

  /* Resolved once for the whole sync. NULL only if the accounts table is
     empty, which 0036 makes impossible on a migrated database — but a posting
     path that THREW here would take down every deal save, so a missing account
     skips the post instead. That is not a silent hole: a commission with no
     ledger row is exactly what /deal-review's "รับคอมแล้ว แต่ยังไม่เข้าบัญชี"
     check looks for, so it surfaces as work rather than as nothing. */
  const accountId = await defaultAccountId();

  const deadKeys = await roleKeys("closing_status", "dead");
  const dealAlive = !(d.closingStatus && deadKeys.includes(d.closingStatus));
  const label = row.listingName ?? row.legacy ?? d.legacyCode ?? "ดีล";

  const [incomeCategory] = await roleKeys("ledger_category", "commission_income");
  const [splitFallback] = await roleKeys("ledger_category", "commission_split");
  const opts = await allOptions();
  const categoryKeys = new Set(
    opts.filter((o) => o.kind === "ledger_category").map((o) => o.key)
  );
  const linkedFor = (payoutRole: string): string | null => {
    const linked = opts.find(
      (o) => o.kind === "payout_role" && o.key === payoutRole
    )?.linkedKey;
    if (linked && categoryKeys.has(linked)) return linked;
    return splitFallback ?? null;
  };

  /* ---- the commission itself ---- */
  const commissionSatang = bahtStrToSatang(d.commission);
  const [revenueRow] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.dealId, dealId), eq(transactions.origin, "deal_revenue")))
    .limit(1);

  const revenueDue =
    dealAlive && commissionSatang != null && commissionSatang > 0 && d.receiveDate != null;
  await upsert(revenueRow, revenueDue, {
    accountId,
    date: d.receiveDate!,
    description: `ค่าคอมมิชชั่น ${label}`,
    direction: "in",
    amountSatang: commissionSatang ?? 0,
    dealId,
    listingId: d.listingId,
    origin: "deal_revenue",
    payoutRole: null,
    category: incomeCategory ?? null,
  });

  /* ---- the splits paid out of it ---- */
  const legs = await db.select().from(dealPayouts).where(eq(dealPayouts.dealId, dealId));
  const liveRoles = new Set(legs.map((l) => l.role));

  for (const leg of legs) {
    const [legRow] = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.dealId, dealId),
          eq(transactions.origin, "deal_payout"),
          eq(transactions.payoutRole, leg.role)
        )
      )
      .limit(1);

    const amountSatang = bahtStrToSatang(leg.amount);
    const legDue =
      dealAlive && leg.paid && amountSatang != null && amountSatang > 0 && leg.paidDate != null;
    await upsert(legRow, legDue, {
      accountId,
      date: leg.paidDate!,
      description: `ส่วนแบ่ง ${leg.role}${leg.payeeName ? ` ${leg.payeeName}` : ""} · ${label}`,
      direction: "out",
      amountSatang: amountSatang ?? 0,
      dealId,
      listingId: d.listingId,
      origin: "deal_payout",
      payoutRole: leg.role,
      category: linkedFor(leg.role),
    });
  }

  /* A split removed from the deal entirely — withdraw its posted row, or the
     withdrawal sits in the balance forever with nothing pointing at it. */
  const orphans = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.dealId, dealId),
        eq(transactions.origin, "deal_payout"),
        isNull(transactions.archivedAt)
      )
    );
  for (const o of orphans) {
    if (o.payoutRole && liveRoles.has(o.payoutRole)) continue;
    await db
      .update(transactions)
      .set({ archivedAt: new Date() })
      .where(eq(transactions.id, o.id));
  }
}

type Existing = typeof transactions.$inferSelect | undefined;

interface Posted {
  /** Null when no account exists at all — upsert() refuses to create. */
  accountId: string | null;
  date: string;
  description: string;
  direction: "in" | "out";
  amountSatang: number;
  dealId: string;
  listingId: string | null;
  origin: "deal_revenue" | "deal_payout";
  payoutRole: string | null;
  category: string | null;
}

/** Create, re-sync, withdraw, or leave alone — the four outcomes in one place
    so the commission and its payout legs cannot drift apart in behaviour. */
async function upsert(existing: Existing, due: boolean, posted: Posted): Promise<LedgerSyncResult> {
  const db = getDb();
  if (!due) {
    if (existing && !existing.archivedAt) {
      await db
        .update(transactions)
        .set({ archivedAt: new Date() })
        .where(eq(transactions.id, existing.id));
      return "withdrawn";
    }
    return "skipped";
  }

  if (!existing) {
    if (posted.accountId == null) {
      console.error("[deal-ledger] no ledger account — commission not posted");
      return "skipped";
    }
    const { accountId, ...rest } = posted;
    await db
      .insert(transactions)
      .values({ ...rest, accountId })
      .onConflictDoNothing();
    return "created";
  }

  // Archived by hand, on purpose. Re-posting would put it back in the balance.
  if (existing.archivedAt) return "skipped";

  const unchanged =
    existing.date === posted.date &&
    existing.amountSatang === posted.amountSatang &&
    existing.direction === posted.direction &&
    existing.description === posted.description;
  if (unchanged) return "skipped";

  // Only the deal-owned fields. Category, receipt, files, remark stay put.
  await db
    .update(transactions)
    .set({
      date: posted.date,
      amountSatang: posted.amountSatang,
      direction: posted.direction,
      description: posted.description,
    })
    .where(eq(transactions.id, existing.id));
  return "updated";
}
