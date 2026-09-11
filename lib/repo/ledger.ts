// Ledger repository — reads for /ledger. Gated by perms.ledger at the page
// and action layer; there is no row-level scoping (the book is the whole
// business, you either see it or you don't).
//
// SINCE 2026-09-11 THE BOOK HAS MORE THAN ONE ACCOUNT. Two things changed
// shape here and both are easy to get subtly wrong:
//
//   THE RUNNING BALANCE IS PER ACCOUNT. A cumulative sum across a company
//   account and a director's account is not a number anybody can reconcile —
//   it describes no statement. So the window function partitions by account
//   and starts from that account's opening balance, which means the คงเหลือ
//   column reads correctly whether you are looking at one account or at all of
//   them side by side.
//
//   THE P&L SKIPS TRANSFERS. Moving ฿100,000 from the company account to the
//   director's is not ฿100,000 of expense and it is not revenue when it lands
//   — the money never left the business. Both balances must move and the
//   statement must not. See `origin = 'transfer'` below and the transferGroupId
//   note in lib/db/schema/sales.ts.

import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  sql,
} from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, ledgerAccounts, listings, transactions } from "@/lib/db/schema";
import { allOptions } from "./options";
import { buildProfitAndLoss, type ProfitAndLoss } from "@/lib/ledger";

export type TransactionRow = typeof transactions.$inferSelect & {
  /** Balance of THIS ROW'S ACCOUNT after this row — the account's opening
      balance plus every live row up to here, oldest-first, computed over the
      whole account rather than the filtered window (a windowed balance is
      meaningless) and never mixed with another account's money. */
  balanceSatang: number;
  accountName: string;
  listingName: string | null;
};

export interface LedgerFilters {
  year: number;
  month?: number; // 1–12
  /** One account, or every account when omitted. */
  accountId?: string;
}

export async function listTransactions(f: LedgerFilters): Promise<TransactionRow[]> {
  const db = getDb();
  const from = `${f.year}-${String(f.month ?? 1).padStart(2, "0")}-01`;
  const toExclusive = f.month
    ? f.month === 12
      ? `${f.year + 1}-01-01`
      : `${f.year}-${String(f.month + 1).padStart(2, "0")}-01`
    : `${f.year + 1}-01-01`;

  const signed = sql`case when ${transactions.direction} = 'in' then ${transactions.amountSatang} else -${transactions.amountSatang} end`;
  // PARTITION BY the account and start from its opening balance: the number in
  // the คงเหลือ column is what that one account held after that one row, which
  // is the only reading that can be checked against a bank statement.
  const balance =
    sql<string>`${ledgerAccounts.openingBalanceSatang} + sum(${signed}) over (partition by ${transactions.accountId} order by ${transactions.date}, ${transactions.createdAt}, ${transactions.id})`.as(
      "balance_satang"
    );

  const w = db
    .select({
      ...getTableColumns(transactions),
      balanceSatang: balance,
      accountName: ledgerAccounts.name,
    })
    .from(transactions)
    .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, transactions.accountId))
    .where(isNull(transactions.archivedAt))
    .as("w");

  // The account filter lands on the OUTER query on purpose. Filtering inside
  // would not change the numbers (the window is partitioned by account
  // already), but it would throw away the rows the other accounts' balances
  // are built from for no gain, and it keeps the window's meaning independent
  // of what the page happens to be showing.
  const rows = await db
    .select()
    .from(w)
    .where(
      and(
        gte(w.date, from),
        lt(w.date, toExclusive),
        f.accountId ? eq(w.accountId, f.accountId) : undefined
      )
    )
    .orderBy(desc(w.date), desc(w.createdAt));

  const listingIds = [
    ...new Set(rows.map((r) => r.listingId).filter((x): x is string => !!x)),
  ];
  const names = listingIds.length
    ? await db
        .select({
          id: listings.id,
          name: listings.listingName,
          legacy: listings.legacyCode,
        })
        .from(listings)
        .where(inArray(listings.id, listingIds))
    : [];
  const nameById = new Map(names.map((n) => [n.id, n.name ?? n.legacy]));

  return rows.map((r) => ({
    ...r,
    balanceSatang: Number(r.balanceSatang),
    listingName: r.listingId ? (nameById.get(r.listingId) ?? null) : null,
  }));
}

/**
 * Every account's money added up — opening balances included.
 *
 * ARCHIVED ACCOUNTS COUNT. An account should be emptied before it is closed,
 * so in practice this adds zero; if it does not, the money is still somewhere
 * and a company total that quietly omits it would be the wrong kind of tidy.
 */
export async function currentBalance(): Promise<number> {
  const db = getDb();
  const [[opening], [movement]] = await Promise.all([
    db
      .select({
        n: sql<string>`coalesce(sum(${ledgerAccounts.openingBalanceSatang}), 0)`,
      })
      .from(ledgerAccounts),
    db
      .select({
        n: sql<string>`coalesce(sum(case when ${transactions.direction} = 'in' then ${transactions.amountSatang} else -${transactions.amountSatang} end), 0)`,
      })
      .from(transactions)
      .where(isNull(transactions.archivedAt)),
  ]);
  return Number(opening.n) + Number(movement.n);
}

/**
 * P&L for one year, from live rows + the current chart of accounts.
 *
 * ACROSS EVERY ACCOUNT, and intentionally so: a profit statement is about the
 * business, not about one bank account. Which account a salary was paid from
 * does not change that it was a salary.
 *
 * TRANSFERS ARE EXCLUDED, which is the whole reason they are a distinct
 * `origin` rather than just two ordinary rows. Money moving between the
 * company's own accounts would otherwise appear as an expense on one side and
 * revenue on the other — both balances correct, every margin on the statement
 * wrong, and nothing on screen to say why. Excluding here rather than by
 * leaving the category blank matters too: a blank category lands in
 * `uncategorised`, which would report an honest transfer as an accounting
 * failure and train the reader to ignore that warning.
 */
export async function profitAndLoss(year: number): Promise<ProfitAndLoss> {
  const rows = await getDb()
    .select({
      date: transactions.date,
      direction: transactions.direction,
      amountSatang: transactions.amountSatang,
      category: transactions.category,
      isAnnual: transactions.isAnnual,
      annualMonths: transactions.annualMonths,
    })
    .from(transactions)
    .where(and(isNull(transactions.archivedAt), ne(transactions.origin, "transfer")))
    .orderBy(asc(transactions.date));

  const categories = (await allOptions())
    .filter((o) => o.kind === "ledger_category")
    .map((o) => ({ key: o.key, section: o.section }));

  return buildProfitAndLoss(
    rows.map((r) => ({ ...r, amountSatang: Number(r.amountSatang) })),
    year,
    categories
  );
}

/** Years with rows — for the year picker; always includes the current year. */
export async function ledgerYears(nowYear: number): Promise<number[]> {
  const rows = await getDb()
    .select({
      y: sql<number>`distinct extract(year from ${transactions.date})::int`,
    })
    .from(transactions);
  const set = new Set(rows.map((r) => r.y));
  set.add(nowYear);
  return [...set].sort((a, b) => b - a);
}

/** Deals usable in the "file against a deal" picker. */
export async function dealOptionsForLedger(limit = 100) {
  return getDb()
    .select({
      id: deals.id,
      legacyCode: deals.legacyCode,
      listingName: listings.listingName,
    })
    .from(deals)
    .leftJoin(listings, eq(listings.id, deals.listingId))
    .orderBy(desc(deals.updatedAt))
    .limit(limit);
}

/* ── the dashboard ─────────────────────────────────────────────────────── */

export interface MonthFlow {
  /** 1–12 */
  month: number;
  inSatang: number;
  outSatang: number;
  netSatang: number;
}

/**
 * Twelve months of money in and out, every account combined.
 *
 * TRANSFERS EXCLUDED, for the same reason the P&L excludes them — a month in
 * which ฿500,000 was moved between two of the company's own accounts did not
 * see ฿500,000 come in and ฿500,000 go out, and a bar chart that says it did
 * is worse than no chart.
 *
 * Zero months are generated rather than omitted: a quiet stretch that simply
 * disappears makes the year look shorter and busier than it was.
 */
export async function monthlyFlow(year: number): Promise<MonthFlow[]> {
  const res = await getDb().execute(sql`
    with span as (
      select generate_series(1, 12) as month
    )
    select
      span.month::int as month,
      coalesce(sum(t.amount_satang) filter (where t.direction = 'in'), 0)::bigint as in_satang,
      coalesce(sum(t.amount_satang) filter (where t.direction = 'out'), 0)::bigint as out_satang
    from span
    left join ${transactions} t
      on extract(month from t.date) = span.month
     and extract(year from t.date) = ${year}
     and t.archived_at is null
     and t.origin <> 'transfer'
    group by span.month
    order by span.month
  `);
  const rows = res.rows as unknown as {
    month: number;
    in_satang: string;
    out_satang: string;
  }[];
  return rows.map((r) => {
    const inSatang = Number(r.in_satang);
    const outSatang = Number(r.out_satang);
    return { month: r.month, inSatang, outSatang, netSatang: inSatang - outSatang };
  });
}

/**
 * Rows the P&L cannot place — no category, so they are in the bank but not in
 * the statement.
 *
 * Its own small query rather than a read of profitAndLoss().uncategorised: the
 * dashboard wants one number and the P&L builds twelve months of every line to
 * produce it.
 */
export async function uncategorisedCount(year: number): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        isNull(transactions.archivedAt),
        ne(transactions.origin, "transfer"),
        isNull(transactions.category),
        sql`extract(year from ${transactions.date}) = ${year}`
      )
    );
  return row?.n ?? 0;
}
