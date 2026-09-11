"use server";

// Ledger mutations. Gate: perms.ledger. Ownership rule (same as the sync):
// rows with origin != 'manual' are POSTED by lib/repo/deal-ledger.ts, which
// owns their amount, date, direction and description — here only category,
// receipt, files, remark AND THE ACCOUNT may change on those. Archive, never
// delete.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ledgerAccounts, transactions } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { bool, dateStr, int, reqStr, str } from "@/lib/forms";
import { optionStr } from "@/lib/repo/options";
import { defaultAccountId, openAccounts } from "@/lib/repo/ledger-accounts";
import { toSatang } from "@/lib/ledger";

async function requireLedger() {
  const viewer = await getViewer();
  if (!viewer.perms.ledger) redirect("/");
  return viewer;
}

function refresh() {
  revalidatePath("/ledger");
}

/**
 * Resolve the account a form posted, REFUSING anything not on the live list.
 *
 * Validated against the database rather than trusted, for the same reason
 * optionStr() validates a category: a <select> is a suggestion, and the row it
 * writes is a claim about where real money is. An unknown or archived id falls
 * back to the default account instead of failing — a transaction filed to the
 * wrong account is visible and one edit from right; a transaction refused at
 * save time is a number that never reaches the books at all.
 */
async function accountIdFrom(fd: FormData, field = "accountId"): Promise<string> {
  const wanted = str(fd, field);
  const open = await openAccounts();
  if (wanted && open.some((a) => a.id === wanted)) return wanted;
  const fallback = (await defaultAccountId()) ?? open[0]?.id;
  if (!fallback) throw new Error("ยังไม่มีบัญชีในระบบ — สร้างบัญชีก่อนลงรายการ");
  return fallback;
}

async function parseShared(fd: FormData) {
  return {
    accountId: await accountIdFrom(fd),
    category: await optionStr(fd, "category", "ledger_category"),
    dealId: str(fd, "dealId"),
    hasReceipt: bool(fd, "hasReceipt"),
    filesLink: str(fd, "filesLink"),
    remark: str(fd, "remark"),
    isAnnual: bool(fd, "isAnnual"),
    annualMonths: int(fd, "annualMonths") ?? 12,
  };
}

function parseMoney(fd: FormData) {
  const date = dateStr(fd, "date");
  if (!date) throw new Error("ต้องระบุวันที่");
  const amountSatang = toSatang(reqStr(fd, "amount"));
  if (amountSatang == null || amountSatang <= 0)
    throw new Error("จำนวนเงินไม่ถูกต้อง");
  const direction = str(fd, "direction") === "in" ? "in" : ("out" as const);
  return { date, amountSatang, direction: direction as "in" | "out" };
}

export async function createTransaction(fd: FormData) {
  const viewer = await requireLedger();
  await getDb()
    .insert(transactions)
    .values({
      ...parseMoney(fd),
      description: reqStr(fd, "description"),
      ...(await parseShared(fd)),
      origin: "manual",
      createdBy: viewer.userId,
    });
  refresh();
  redirect("/ledger");
}

export async function updateTransaction(id: string, fd: FormData) {
  await requireLedger();
  const db = getDb();
  const [row] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);
  if (!row) redirect("/ledger");

  const shared = await parseShared(fd);
  const values =
    row.origin === "manual"
      ? { ...parseMoney(fd), description: reqStr(fd, "description"), ...shared }
      : shared; // deal-posted rows: the deal owns the money fields

  await db.update(transactions).set(values).where(eq(transactions.id, id));
  refresh();
  redirect("/ledger");
}

/** Hide from the book and the P&L; the row survives for the audit trail, and
    the deal sync will not re-post over a hand-archived row. */
export async function archiveTransaction(id: string) {
  await requireLedger();
  await getDb()
    .update(transactions)
    .set({ archivedAt: new Date() })
    .where(eq(transactions.id, id));
  refresh();
}

/* ── moving money between our own accounts ─────────────────────────────── */

/**
 * Record a transfer as ONE INSERT OF TWO ROWS.
 *
 * WHY IT IS NOT JUST TWO ENTRIES. Typed by hand, a transfer is an "เงินออก" on
 * one account and an "เงินเข้า" on the other. Both balances end up right and
 * the P&L ends up wrong — the outgoing leg reads as an expense, the incoming
 * leg as revenue, and the month shows turnover that never happened. Nothing on
 * screen would explain the gap. Pairing the legs under one transferGroupId and
 * marking them `origin: "transfer"` is what lets the statement skip them while
 * the two balances still move (lib/repo/ledger.ts profitAndLoss).
 *
 * ONE STATEMENT because Neon's HTTP driver has no interactive transactions
 * (the same constraint that shapes setDealPayouts). A multi-row INSERT is
 * atomic on its own, so there is no window in which one half of a transfer
 * exists — which would be money visibly vanishing from the company total.
 *
 * THE TWO LEGS CARRY NO CATEGORY, and must not: a category would put them back
 * into the P&L through the other door. They are also skipped by the
 * uncategorised warning for the same reason.
 */
export async function createTransfer(fd: FormData) {
  const viewer = await requireLedger();

  const date = dateStr(fd, "date");
  if (!date) throw new Error("ต้องระบุวันที่");
  const amountSatang = toSatang(reqStr(fd, "amount"));
  if (amountSatang == null || amountSatang <= 0)
    throw new Error("จำนวนเงินไม่ถูกต้อง");

  const open = await openAccounts();
  const fromId = str(fd, "fromAccountId");
  const toId = str(fd, "toAccountId");
  const from = open.find((a) => a.id === fromId);
  const to = open.find((a) => a.id === toId);
  if (!from || !to) throw new Error("เลือกบัญชีต้นทางและปลายทางให้ถูกต้อง");
  // Refused rather than ignored: a transfer to itself is always a mistake, and
  // silently writing two cancelling rows would hide it.
  if (from.id === to.id) throw new Error("บัญชีต้นทางและปลายทางต้องไม่ใช่บัญชีเดียวกัน");

  const note = str(fd, "remark");
  const transferGroupId = crypto.randomUUID();
  const shared = {
    date,
    amountSatang,
    origin: "transfer" as const,
    transferGroupId,
    category: null,
    remark: note,
    createdBy: viewer.userId,
  };

  await getDb()
    .insert(transactions)
    .values([
      {
        ...shared,
        accountId: from.id,
        direction: "out",
        description: `โอนไป ${to.name}`,
      },
      {
        ...shared,
        accountId: to.id,
        direction: "in",
        description: `รับโอนจาก ${from.name}`,
      },
    ]);

  refresh();
  redirect("/ledger");
}

/**
 * Archive BOTH legs of a transfer together.
 *
 * Archiving one leg alone would leave the company total short by the transfer
 * amount for as long as nobody noticed — the money would appear to have left
 * one account and never arrived anywhere. archiveTransaction() above handles
 * ordinary rows; this is the only correct way to withdraw a transfer.
 */
export async function archiveTransfer(groupId: string) {
  await requireLedger();
  await getDb()
    .update(transactions)
    .set({ archivedAt: new Date() })
    .where(eq(transactions.transferGroupId, groupId));
  refresh();
}

/* ── the accounts themselves ───────────────────────────────────────────── */

// Managed here rather than in /settings on purpose: `settings` is a
// superadmin flag and บัญชี does not hold it, so putting the chart of accounts
// behind it would mean the bookkeeper could not open the account they are
// asked to reconcile. These are ledger objects and they live behind
// perms.ledger with the rest of the book.

function parseAccountForm(fd: FormData) {
  const name = reqStr(fd, "name").trim();
  if (!name) throw new Error("ต้องตั้งชื่อบัญชี");
  const kindRaw = str(fd, "kind");
  const kind: "bank" | "cash" | "other" =
    kindRaw === "cash" || kindRaw === "other" ? kindRaw : "bank";
  // SIGNED, and deliberately so: an account can legitimately open overdrawn,
  // and forcing a positive number here would make the only way to record that
  // a fake transaction.
  const opening = toSatang(str(fd, "openingBalance") ?? "0") ?? 0;
  return {
    name,
    kind,
    bankName: str(fd, "bankName"),
    accountNo: str(fd, "accountNo"),
    openingBalanceSatang: opening,
    openingDate: dateStr(fd, "openingDate"),
    note: str(fd, "note"),
    sortOrder: int(fd, "sortOrder") ?? 0,
  };
}

export async function createAccount(fd: FormData) {
  await requireLedger();
  await getDb().insert(ledgerAccounts).values(parseAccountForm(fd));
  refresh();
  redirect("/ledger");
}

export async function updateAccount(id: string, fd: FormData) {
  await requireLedger();
  await getDb()
    .update(ledgerAccounts)
    .set(parseAccountForm(fd))
    .where(eq(ledgerAccounts.id, id));
  refresh();
  redirect("/ledger");
}

/**
 * Move the default flag.
 *
 * TWO STATEMENTS, CLEAR THEN SET, because ledger_accounts_default_idx is a
 * unique partial index: setting the new one first would collide with the old.
 * If the second statement were to fail the table is left with NO default,
 * which defaultAccountId() already handles by falling back to the oldest open
 * account — chosen over the opposite failure mode, two defaults, which would
 * make "where does a commission post" answerable two different ways.
 */
export async function setDefaultAccount(id: string) {
  await requireLedger();
  const db = getDb();
  await db
    .update(ledgerAccounts)
    .set({ isDefault: false })
    .where(and(eq(ledgerAccounts.isDefault, true), ne(ledgerAccounts.id, id)));
  await db
    .update(ledgerAccounts)
    .set({ isDefault: true })
    .where(eq(ledgerAccounts.id, id));
  refresh();
}

/**
 * Close an account without destroying its history.
 *
 * NEVER DELETE — the foreign key from transactions is RESTRICT, and that is
 * the point: the rows pointing here are claims about where money actually
 * went. Archiving takes it out of the pickers and leaves every past statement
 * intact.
 *
 * Two refusals, both to stop the ledger from reaching a state with no usable
 * account: the last open account cannot be closed, and the default must be
 * handed to someone else first.
 */
export async function archiveAccount(id: string) {
  await requireLedger();
  const db = getDb();
  const open = await openAccounts();
  if (open.length <= 1) throw new Error("ต้องมีบัญชีที่ใช้งานอยู่อย่างน้อยหนึ่งบัญชี");
  const target = open.find((a) => a.id === id);
  if (!target) return;
  if (target.isDefault)
    throw new Error("ตั้งบัญชีอื่นเป็นบัญชีหลักก่อน จึงจะปิดบัญชีนี้ได้");

  await db
    .update(ledgerAccounts)
    .set({ archivedAt: new Date() })
    .where(eq(ledgerAccounts.id, id));
  refresh();
}

export async function reopenAccount(id: string) {
  await requireLedger();
  await getDb()
    .update(ledgerAccounts)
    .set({ archivedAt: null })
    .where(eq(ledgerAccounts.id, id));
  refresh();
}
