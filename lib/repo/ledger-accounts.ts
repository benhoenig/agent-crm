/* The accounts the money sits in — reads for /ledger and the one lookup the
   deal auto-posting needs.
 *
 * See lib/db/schema/sales.ts ledgerAccounts for why this table exists and why
 * an opening balance is mandatory rather than nice to have.
 *
 * EVERY BALANCE IN THE APP IS OPENING + MOVEMENT, computed here and nowhere
 * else. The alternative — a stored `balance` column kept in step by triggers
 * or by application code — is the classic way for a ledger to start lying:
 * one missed update and the number on screen no longer follows from the rows
 * underneath it, with nothing to show which of the two is wrong. Summing on
 * read is a few milliseconds over a table this size and can only ever agree
 * with the transactions.
 */

import { asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ledgerAccounts, transactions } from "@/lib/db/schema";

export type AccountKind = "bank" | "cash" | "other";

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  bank: "บัญชีธนาคาร",
  cash: "เงินสด",
  other: "อื่นๆ",
};

export interface AccountBalance {
  id: string;
  name: string;
  kind: AccountKind;
  bankName: string | null;
  accountNo: string | null;
  openingBalanceSatang: number;
  openingDate: string | null;
  isDefault: boolean;
  sortOrder: number;
  note: string | null;
  archivedAt: Date | null;
  /** Opening balance plus every live row, all time. What the bank should say. */
  balanceSatang: number;
  /** Everything that moved on THIS account inside the window — internal
      transfers included, because a transfer really did land in this account
      and a bank statement for it would show the line. */
  inSatang: number;
  outSatang: number;
  /** The same window with transfers between our own accounts removed — money
      the BUSINESS took in and paid out.

      BOTH ARE NEEDED, and using one where the other belongs is the trap this
      table was always going to set. Per account, a transfer is real movement.
      Added up across every account it is double-counted noise: move ฿3,000
      from one of our accounts to another and a company header built on
      `inSatang` reads "เงินเข้า 3,000 · เงินออก 3,000" — a business that
      turned over ฿6,000 on a day it earned nothing. The net comes out right,
      which is exactly why nobody would catch it. */
  inExclTransfersSatang: number;
  outExclTransfersSatang: number;
  /** Live rows on this account, all time — what makes it undeletable. */
  rowCount: number;
}

/**
 * Every account with its balance, plus in/out over one window.
 *
 * ONE QUERY, not one per account: the window figures come from FILTER clauses
 * on the same aggregate as the all-time balance, so adding a seventh account
 * costs nothing. Archived accounts are INCLUDED — an account closed in March
 * still holds this year's history, and dropping it from the list would make
 * the year's totals stop adding up. Callers hide them from the pickers.
 */
export async function accountBalances(
  from: string,
  toExclusive: string
): Promise<AccountBalance[]> {
  const rows = await getDb()
    .select({
      id: ledgerAccounts.id,
      name: ledgerAccounts.name,
      kind: ledgerAccounts.kind,
      bankName: ledgerAccounts.bankName,
      accountNo: ledgerAccounts.accountNo,
      openingBalanceSatang: ledgerAccounts.openingBalanceSatang,
      openingDate: ledgerAccounts.openingDate,
      isDefault: ledgerAccounts.isDefault,
      sortOrder: ledgerAccounts.sortOrder,
      note: ledgerAccounts.note,
      archivedAt: ledgerAccounts.archivedAt,
      movement: sql<string>`coalesce(sum(case when ${transactions.direction} = 'in' then ${transactions.amountSatang} else -${transactions.amountSatang} end), 0)`,
      inSatang: sql<string>`coalesce(sum(${transactions.amountSatang}) filter (where ${transactions.direction} = 'in' and ${transactions.date} >= ${from} and ${transactions.date} < ${toExclusive}), 0)`,
      outSatang: sql<string>`coalesce(sum(${transactions.amountSatang}) filter (where ${transactions.direction} = 'out' and ${transactions.date} >= ${from} and ${transactions.date} < ${toExclusive}), 0)`,
      inExclTransfersSatang: sql<string>`coalesce(sum(${transactions.amountSatang}) filter (where ${transactions.direction} = 'in' and ${transactions.origin} <> 'transfer' and ${transactions.date} >= ${from} and ${transactions.date} < ${toExclusive}), 0)`,
      outExclTransfersSatang: sql<string>`coalesce(sum(${transactions.amountSatang}) filter (where ${transactions.direction} = 'out' and ${transactions.origin} <> 'transfer' and ${transactions.date} >= ${from} and ${transactions.date} < ${toExclusive}), 0)`,
      rowCount: sql<number>`count(${transactions.id})::int`,
    })
    .from(ledgerAccounts)
    // The archived_at test belongs in the JOIN, not the WHERE: in a WHERE it
    // would turn the LEFT JOIN into an inner one and an account with only
    // archived rows would vanish from the list entirely.
    .leftJoin(
      transactions,
      sql`${transactions.accountId} = ${ledgerAccounts.id} and ${transactions.archivedAt} is null`
    )
    .groupBy(ledgerAccounts.id)
    .orderBy(asc(ledgerAccounts.sortOrder), asc(ledgerAccounts.createdAt));

  return rows.map((r) => ({
    ...r,
    kind: r.kind as AccountKind,
    openingBalanceSatang: Number(r.openingBalanceSatang),
    balanceSatang: Number(r.openingBalanceSatang) + Number(r.movement),
    inSatang: Number(r.inSatang),
    outSatang: Number(r.outSatang),
    inExclTransfersSatang: Number(r.inExclTransfersSatang),
    outExclTransfersSatang: Number(r.outExclTransfersSatang),
  }));
}

/** The pickers' list — everything still open, in display order. */
export async function openAccounts() {
  return getDb()
    .select({
      id: ledgerAccounts.id,
      name: ledgerAccounts.name,
      kind: ledgerAccounts.kind,
      isDefault: ledgerAccounts.isDefault,
    })
    .from(ledgerAccounts)
    .where(isNull(ledgerAccounts.archivedAt))
    .orderBy(asc(ledgerAccounts.sortOrder), asc(ledgerAccounts.createdAt));
}

/**
 * Where an unattributed row lands.
 *
 * FALLS BACK TO THE OLDEST ACCOUNT rather than returning null. Its only
 * caller that cannot cope with null is the deal auto-posting, and a commission
 * that refuses to post because somebody un-defaulted every account is a
 * silent hole in the books — much worse than a commission posted to the wrong
 * account, which is visible and one edit away from right. The database
 * guarantees at most one default (ledger_accounts_default_idx); nothing
 * guarantees at least one.
 */
export async function defaultAccountId(): Promise<string | null> {
  const db = getDb();
  const [preferred] = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.isDefault, true))
    .limit(1);
  if (preferred) return preferred.id;

  const [oldest] = await db
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(isNull(ledgerAccounts.archivedAt))
    .orderBy(asc(ledgerAccounts.sortOrder), asc(ledgerAccounts.createdAt))
    .limit(1);
  return oldest?.id ?? null;
}

/** One account, for the edit form and the archive guard. */
export async function getAccount(id: string) {
  const [row] = await getDb()
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.id, id))
    .limit(1);
  return row ?? null;
}
