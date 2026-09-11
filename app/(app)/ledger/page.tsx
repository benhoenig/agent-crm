/* สมุดบัญชี — the books, now across more than one account (Ben, 2026-09-11:
 * "ระบบบัญชี -> เพิ่ม account transaction อีกอัน -> show รวมเป็น dashboard
 * ได้").
 *
 * FOUR VIEWS, AND ภาพรวม IS THE DEFAULT. It used to open straight onto the
 * transaction list, which was the right landing page while there was one
 * account and one number to read. With several, the first question is "how
 * much do we have, and where" — every account's balance side by side plus the
 * company total — and the row-by-row book is the thing you open second, after
 * you know which account you are reconciling.
 *
 * THE RUNNING BALANCE IS PER ACCOUNT even in the combined view, so the คงเหลือ
 * column can always be checked against a real bank statement. See
 * lib/repo/ledger.ts.
 *
 * TRANSFERS ARE THEIR OWN FORM, not two hand-typed rows. See createTransfer in
 * ./actions for why a transfer typed as an "out" and an "in" breaks the P&L
 * while leaving both balances correct — the most expensive kind of wrong,
 * because nothing on screen looks broken.
 */

import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Pill,
  Select,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import {
  currentBalance,
  dealOptionsForLedger,
  ledgerYears,
  listTransactions,
  monthlyFlow,
  profitAndLoss,
  uncategorisedCount,
} from "@/lib/repo/ledger";
import {
  accountBalances,
  ACCOUNT_KIND_LABEL,
  type AccountBalance,
} from "@/lib/repo/ledger-accounts";
import { dealReviewBoard } from "@/lib/repo/deal-review";
import { optionsFor } from "@/lib/repo/options";
import { baht, THAI_MONTHS } from "@/lib/ledger";
import { bkkToday, formatDate, formatNum } from "@/lib/format";
import { param, type Search } from "@/lib/search-params";
import {
  archiveAccount,
  archiveTransaction,
  archiveTransfer,
  createAccount,
  createTransaction,
  createTransfer,
  reopenAccount,
  setDefaultAccount,
  updateAccount,
  updateTransaction,
} from "./actions";

export const dynamic = "force-dynamic";

type View = "dashboard" | "ledger" | "pl" | "accounts";

function Amount({ satang, dir }: { satang: number; dir?: "in" | "out" }) {
  const tone =
    dir === "in" ? "text-good" : dir === "out" ? "text-ink" : undefined;
  return (
    <span className={`num ${tone ?? ""}`}>
      {dir === "out" ? "-" : dir === "in" ? "+" : ""}
      {baht(satang)}
    </span>
  );
}

/** One account at a glance. The balance is the headline because it is the
    number that gets compared against a bank app; the window's movement is the
    small print under it. */
function AccountCard({
  a,
  windowLabel,
  href,
}: {
  a: AccountBalance;
  windowLabel: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-card border border-line bg-surface-2 p-4 transition-colors hover:border-accent/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{a.name}</div>
          <div className="truncate pt-0.5 text-xs text-ink-3">
            {[
              ACCOUNT_KIND_LABEL[a.kind],
              a.bankName,
              a.accountNo ? `•••${a.accountNo}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {a.isDefault ? <Pill tone="accent">บัญชีหลัก</Pill> : null}
          {a.archivedAt ? <Pill tone="muted">ปิดแล้ว</Pill> : null}
        </div>
      </div>
      <div
        className={`num pt-3 text-xl font-bold ${a.balanceSatang < 0 ? "text-bad" : ""}`}
      >
        {baht(a.balanceSatang)}
      </div>
      {/* This account's own movement, transfers included — what its bank
          statement would show for the window. */}
      <div className="pt-1 text-xs text-ink-3">
        {windowLabel} · เข้า{" "}
        <span className="num text-good">{baht(a.inSatang)}</span> · ออก{" "}
        <span className="num">{baht(a.outSatang)}</span>
      </div>
    </Link>
  );
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const viewer = await getViewer();
  if (!viewer.perms.ledger) redirect("/");

  const sp = await searchParams;
  const today = bkkToday(); // "YYYY-MM-DD"
  const nowYear = Number(today.slice(0, 4));
  const year = Number(param(sp, "year")) || nowYear;
  const monthParam = Number(param(sp, "month")) || undefined;
  const viewParam = param(sp, "view");
  const view: View =
    viewParam === "ledger" || viewParam === "pl" || viewParam === "accounts"
      ? viewParam
      : "dashboard";
  const editId = param(sp, "edit") || undefined;
  const editAccountId = param(sp, "editAccount") || undefined;
  const accountId = param(sp, "account") || undefined;

  const from = `${year}-${String(monthParam ?? 1).padStart(2, "0")}-01`;
  const toExclusive = monthParam
    ? monthParam === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(monthParam + 1).padStart(2, "0")}-01`
    : `${year + 1}-01-01`;
  const windowLabel = `${monthParam ? THAI_MONTHS[monthParam - 1] + " " : ""}${year + 543}`;

  const [accounts, balance, years, categories, dealOpts] = await Promise.all([
    accountBalances(from, toExclusive),
    currentBalance(),
    ledgerYears(nowYear),
    optionsFor("ledger_category"),
    dealOptionsForLedger(),
  ]);

  // Only the active view's heavier queries run — the P&L builds twelve months
  // of every line, and the review board reads every deal.
  const [rows, pl, flow, uncategorised, review] = await Promise.all([
    view === "ledger"
      ? listTransactions({ year, month: monthParam, accountId })
      : Promise.resolve([]),
    view === "pl" ? profitAndLoss(year) : Promise.resolve(null),
    view === "dashboard" ? monthlyFlow(year) : Promise.resolve([]),
    view === "dashboard" ? uncategorisedCount(year) : Promise.resolve(0),
    view === "dashboard" ? dealReviewBoard(viewer) : Promise.resolve(null),
  ]);

  const openAccountList = accounts.filter((a) => a.archivedAt == null);
  const editing = editId ? rows.find((r) => r.id === editId) : undefined;
  const editingAccount = editAccountId
    ? accounts.find((a) => a.id === editAccountId)
    : undefined;
  const activeAccount = accountId
    ? accounts.find((a) => a.id === accountId)
    : undefined;

  // EXCLUDING TRANSFERS, because this row is about the business and a
  // transfer between our own accounts is not income or spending — summing the
  // per-account figures would report ฿3,000 in and ฿3,000 out on a day nobody
  // earned or paid anything. The per-account cards below keep the full
  // movement, which is what their own bank statements would show.
  const totalIn = accounts.reduce((n, a) => n + a.inExclTransfersSatang, 0);
  const totalOut = accounts.reduce((n, a) => n + a.outExclTransfersSatang, 0);

  const hrefFor = (over: Record<string, string | null>) => {
    const qs = new URLSearchParams();
    const merged: Record<string, string | null> = {
      year: String(year),
      month: monthParam ? String(monthParam) : null,
      view: view === "dashboard" ? null : view,
      account: accountId ?? null,
      ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/ledger?${s}` : "/ledger";
  };

  const TABS: { key: View; label: string }[] = [
    { key: "dashboard", label: "ภาพรวม" },
    { key: "ledger", label: "สมุดบัญชี" },
    { key: "pl", label: "งบกำไรขาดทุน (P&L)" },
    { key: "accounts", label: `บัญชีธนาคาร (${openAccountList.length})` },
  ];

  const peakFlow = flow.reduce(
    (m, f) => Math.max(m, f.inSatang, f.outSatang),
    0
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="สมุดบัญชี & งบกำไรขาดทุน"
        sub="เงินเข้า-ออกจริงของทุกบัญชี — ดีลที่รับคอมแล้วลงรายการให้อัตโนมัติ"
        action={
          viewer.perms.dealReview ? (
            <LinkButton variant="secondary" href="/deal-review">
              ตรวจดีล →
            </LinkButton>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          label="ยอดรวมทุกบัญชี"
          value={
            <span className={`num ${balance < 0 ? "text-bad" : ""}`}>
              {baht(balance)}
            </span>
          }
          sub={`${formatNum(openAccountList.length)} บัญชี · รวมยอดยกมา`}
        />
        <Stat
          label={`เงินเข้า (${windowLabel})`}
          value={<Amount satang={totalIn} />}
          sub="ไม่นับการโอนระหว่างบัญชีของเราเอง"
        />
        <Stat label="เงินออก" value={<span className="num">{baht(totalOut)}</span>} />
        <Stat label="สุทธิในช่วงนี้" value={<Amount satang={totalIn - totalOut} />} />
      </div>

      {/* view + window switcher */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={hrefFor({
                view: t.key === "dashboard" ? null : t.key,
                edit: null,
                editAccount: null,
                // The P&L is a whole-year statement; carrying a month filter
                // into it would label a twelve-column table with one month.
                // Spread rather than `month: undefined`, which hrefFor would
                // read as "clear it" — every key it receives overrides.
                ...(t.key === "pl" ? { month: null } : {}),
              })}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${view === t.key ? "bg-accent-soft text-accent-text" : "text-ink-2 hover:text-ink"}`}
            >
              {t.label}
            </Link>
          ))}
          <div className="mx-2 h-5 w-px bg-line" />
          {years.map((y) => (
            <Link
              key={y}
              href={hrefFor({ year: String(y) })}
              className={`rounded-full px-3 py-1.5 text-xs ${y === year ? "bg-accent-soft font-semibold text-accent-text" : "text-ink-2 hover:text-ink"}`}
            >
              {y + 543}
            </Link>
          ))}
          {view === "ledger" || view === "dashboard" ? (
            <>
              <div className="mx-2 h-5 w-px bg-line" />
              <Link
                href={hrefFor({ month: null })}
                className={`rounded-full px-2.5 py-1 text-xs ${!monthParam ? "bg-accent-soft font-semibold text-accent-text" : "text-ink-2 hover:text-ink"}`}
              >
                ทั้งปี
              </Link>
              {THAI_MONTHS.map((m, i) => (
                <Link
                  key={m}
                  href={hrefFor({ month: String(i + 1) })}
                  className={`rounded-full px-2.5 py-1 text-xs ${monthParam === i + 1 ? "bg-accent-soft font-semibold text-accent-text" : "text-ink-2 hover:text-ink"}`}
                >
                  {m}
                </Link>
              ))}
            </>
          ) : null}
        </div>
      </Card>

      {/* ═══ ภาพรวม ═══════════════════════════════════════════════════ */}
      {view === "dashboard" ? (
        <>
          <Card>
            <CardHeader
              title="ยอดคงเหลือแต่ละบัญชี"
              action={
                <span className="text-xs text-ink-3">
                  กดที่บัญชีเพื่อดูรายการเฉพาะบัญชีนั้น
                </span>
              }
            />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((a) => (
                <AccountCard
                  key={a.id}
                  a={a}
                  windowLabel={windowLabel}
                  href={hrefFor({ view: "ledger", account: a.id })}
                />
              ))}
            </div>
          </Card>

          {/* Things the books are waiting on. Deliberately above the chart:
              a number that is missing matters more than a number that is
              merely interesting. */}
          {uncategorised > 0 || (review && review.summary.unpostedSatang > 0) ? (
            <Card className="border-warn/40">
              <CardHeader title="ต้องจัดการก่อน ตัวเลขถึงจะครบ" />
              <ul className="space-y-2 px-5 pb-5 text-sm">
                {review && review.summary.unpostedSatang > 0 ? (
                  <li className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-warn">
                      ค่าคอม {baht(review.summary.unpostedSatang)} ยังไม่เข้าสมุดบัญชี
                    </span>
                    <span className="text-ink-2">
                      — ดีลบอกว่าได้คอมแล้ว แต่ยังไม่มีวันรับเงิน จึงยังไม่มีรายการในบัญชี
                    </span>
                    <Link
                      href="/deal-review"
                      className="text-xs font-semibold text-accent-text hover:underline"
                    >
                      ไปหน้าตรวจดีล →
                    </Link>
                  </li>
                ) : null}
                {uncategorised > 0 ? (
                  <li className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-warn">
                      {formatNum(uncategorised)} รายการยังไม่จัดหมวด
                    </span>
                    <span className="text-ink-2">
                      — อยู่ในยอดคงเหลือ แต่ไม่ถูกนับใน P&L จนกว่าจะเลือกหมวด
                    </span>
                    <Link
                      href={hrefFor({ view: "ledger", account: null })}
                      className="text-xs font-semibold text-accent-text hover:underline"
                    >
                      เปิดสมุดบัญชี →
                    </Link>
                  </li>
                ) : null}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title={`เงินเข้า-ออกรายเดือน ${year + 543}`}
              action={
                <span className="text-xs text-ink-3">
                  ทุกบัญชีรวมกัน · ไม่นับการโอนระหว่างบัญชีของเราเอง
                </span>
              }
            />
            <Table>
              <thead>
                <tr>
                  <Th>เดือน</Th>
                  <Th className="text-right">เข้า</Th>
                  <Th className="text-right">ออก</Th>
                  <Th className="text-right">สุทธิ</Th>
                  <Th className="w-2/5" />
                </tr>
              </thead>
              <tbody>
                {flow.map((f) => (
                  <tr key={f.month} className="border-b border-line/60">
                    <Td className="whitespace-nowrap">{THAI_MONTHS[f.month - 1]}</Td>
                    <Td className="num text-right text-good">
                      {f.inSatang === 0 ? "–" : baht(f.inSatang)}
                    </Td>
                    <Td className="num text-right text-ink-2">
                      {f.outSatang === 0 ? "–" : baht(f.outSatang)}
                    </Td>
                    <Td
                      className={`num text-right font-semibold ${f.netSatang < 0 ? "text-bad" : ""}`}
                    >
                      {f.inSatang === 0 && f.outSatang === 0 ? "–" : baht(f.netSatang)}
                    </Td>
                    <Td>
                      {/* Two bars on one scale, so a month's in and out can be
                          compared to each other AND to every other month. */}
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-good/70" style={{ width: peakFlow > 0 ? `${(f.inSatang / peakFlow) * 100}%` : "0%" }} />
                        <div className="h-1.5 rounded-full bg-ink-3/50" style={{ width: peakFlow > 0 ? `${(f.outSatang / peakFlow) * 100}%` : "0%" }} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      ) : null}

      {/* ═══ งบกำไรขาดทุน ══════════════════════════════════════════════ */}
      {view === "pl" && pl ? (
        <>
          {pl.uncategorised.count > 0 ? (
            <Card className="border-warn/40 p-4 text-sm">
              <span className="font-semibold text-warn">
                {pl.uncategorised.count} รายการยังไม่จัดหมวด
              </span>{" "}
              <span className="text-ink-2">
                (เข้า {baht(pl.uncategorised.totalIn)} · ออก {baht(pl.uncategorised.totalOut)})
                — ไม่ถูกนับใน P&L จนกว่าจะเลือกหมวด
              </span>
            </Card>
          ) : null}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-3">
                    <th className="py-2 pl-5 font-medium">รายการ</th>
                    {THAI_MONTHS.map((m) => (
                      <th key={m} className="px-2 py-2 text-right font-medium">
                        {m}
                      </th>
                    ))}
                    <th className="py-2 pr-5 text-right font-medium">รวมปี</th>
                  </tr>
                </thead>
                <tbody>
                  {pl.blocks.map((b) => (
                    <Fragment key={b.section}>
                      <tr className="border-b border-line bg-surface-2/50">
                        <td className="py-2 pl-5 font-semibold">{b.title}</td>
                        {b.months.map((n, i) => (
                          <td key={i} className="num px-2 py-2 text-right text-ink-2">
                            {n === 0 ? "–" : baht(n)}
                          </td>
                        ))}
                        <td className="num py-2 pr-5 text-right font-semibold">{baht(b.total)}</td>
                      </tr>
                      {b.lines.map((l) => (
                        <tr key={l.category} className="border-b border-line/50">
                          <td className="py-1.5 pl-8 text-ink-2">{l.category}</td>
                          {l.months.map((n, i) => (
                            <td key={i} className="num px-2 py-1.5 text-right text-ink-3">
                              {n === 0 ? "" : baht(n)}
                            </td>
                          ))}
                          <td className="num py-1.5 pr-5 text-right text-ink-2">{baht(l.total)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  {[
                    { label: "กำไรขั้นต้น (Gross Profit)", months: pl.grossProfit, total: pl.totals.grossProfit },
                    { label: "ค่าใช้จ่ายดำเนินงานรวม", months: pl.operatingExpenses, total: pl.totals.operatingExpenses },
                    { label: "กำไรสุทธิ (Net Profit)", months: pl.netProfit, total: pl.totals.netProfit },
                  ].map((r) => (
                    <tr key={r.label} className="border-t-2 border-line">
                      <td className="py-2.5 pl-5 font-bold">{r.label}</td>
                      {r.months.map((n, i) => (
                        <td key={i} className={`num px-2 py-2.5 text-right font-semibold ${n < 0 ? "text-bad" : ""}`}>
                          {n === 0 ? "–" : baht(n)}
                        </td>
                      ))}
                      <td className={`num py-2.5 pr-5 text-right font-bold ${r.total < 0 ? "text-bad" : ""}`}>
                        {baht(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="px-1 text-xs leading-relaxed text-ink-3">
            งบนี้รวมทุกบัญชีเข้าด้วยกัน — เงินเดือนที่จ่ายจากบัญชีไหนก็ยังเป็นเงินเดือน ·
            การโอนเงินระหว่างบัญชีของบริษัทเองไม่ถูกนับเป็นรายได้หรือค่าใช้จ่าย
          </p>
        </>
      ) : null}

      {/* ═══ บัญชีธนาคาร ══════════════════════════════════════════════ */}
      {view === "accounts" ? (
        <>
          <Card>
            <CardHeader
              title={editingAccount ? `แก้ไข ${editingAccount.name}` : "เพิ่มบัญชีใหม่"}
              action={
                editingAccount ? (
                  <LinkButton variant="ghost" href={hrefFor({ editAccount: null })}>
                    ยกเลิก
                  </LinkButton>
                ) : undefined
              }
            />
            <form
              action={
                editingAccount
                  ? updateAccount.bind(null, editingAccount.id)
                  : createAccount
              }
              className="grid grid-cols-2 gap-3 px-5 pb-5 md:grid-cols-4"
            >
              <Field label="ชื่อบัญชี *">
                <Input
                  name="name"
                  defaultValue={editingAccount?.name ?? ""}
                  placeholder="เช่น บัญชีบริษัท / บัญชีส่วนตัวเจ้าของ"
                  required
                />
              </Field>
              <Field label="ประเภท">
                <Select name="kind" defaultValue={editingAccount?.kind ?? "bank"}>
                  <option value="bank">บัญชีธนาคาร</option>
                  <option value="cash">เงินสด</option>
                  <option value="other">อื่นๆ</option>
                </Select>
              </Field>
              <Field label="ธนาคาร">
                <Input name="bankName" defaultValue={editingAccount?.bankName ?? ""} placeholder="เช่น กสิกรไทย" />
              </Field>
              <Field label="เลขบัญชี (4 ตัวท้าย)">
                <Input name="accountNo" defaultValue={editingAccount?.accountNo ?? ""} className="num" placeholder="1234" />
              </Field>
              <Field label="ยอดยกมา (฿)">
                <Input
                  name="openingBalance"
                  defaultValue={
                    editingAccount ? baht(editingAccount.openingBalanceSatang) : "0.00"
                  }
                  className="num"
                />
              </Field>
              <Field label="ยอดยกมา ณ วันที่">
                <Input type="date" name="openingDate" defaultValue={editingAccount?.openingDate ?? ""} />
              </Field>
              <Field label="ลำดับการแสดง">
                <Input name="sortOrder" defaultValue={editingAccount?.sortOrder ?? 0} className="num" />
              </Field>
              <Field label="หมายเหตุ">
                <Input name="note" defaultValue={editingAccount?.note ?? ""} />
              </Field>
              <div className="col-span-2 flex items-end justify-between gap-3 md:col-span-4">
                <p className="text-xs leading-relaxed text-ink-3">
                  ยอดยกมาคือเงินที่มีอยู่ในบัญชีก่อนเริ่มใช้ระบบนี้ — ถ้าไม่ใส่
                  ยอดคงเหลือในระบบจะไม่มีวันตรงกับแอปธนาคาร
                </p>
                <Button type="submit">{editingAccount ? "บันทึก" : "เพิ่มบัญชี"}</Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title={`บัญชีทั้งหมด (${accounts.length})`} />
            <Table>
              <thead>
                <tr>
                  <Th>บัญชี</Th>
                  <Th className="text-right">ยอดยกมา</Th>
                  <Th className="text-right">รายการ</Th>
                  <Th className="text-right">ยอดคงเหลือ</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-line/60">
                    <Td wrap>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.name}</span>
                        {a.isDefault ? <Pill tone="accent">บัญชีหลัก</Pill> : null}
                        {a.archivedAt ? <Pill tone="muted">ปิดแล้ว</Pill> : null}
                      </div>
                      <div className="pt-0.5 text-xs text-ink-3">
                        {[
                          ACCOUNT_KIND_LABEL[a.kind],
                          a.bankName,
                          a.accountNo ? `•••${a.accountNo}` : null,
                          a.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </Td>
                    <Td className="num text-right text-ink-2">
                      {baht(a.openingBalanceSatang)}
                      {a.openingDate ? (
                        <div className="text-xs text-ink-3">{formatDate(a.openingDate)}</div>
                      ) : null}
                    </Td>
                    <Td className="num text-right text-ink-3">{formatNum(a.rowCount)}</Td>
                    <Td className={`num text-right font-semibold ${a.balanceSatang < 0 ? "text-bad" : ""}`}>
                      {baht(a.balanceSatang)}
                    </Td>
                    <Td wrap className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={hrefFor({ editAccount: a.id })}
                          className="text-xs text-ink-3 hover:text-ink"
                        >
                          แก้ไข
                        </Link>
                        {!a.isDefault && a.archivedAt == null ? (
                          <form action={setDefaultAccount.bind(null, a.id)}>
                            <button className="px-1 text-xs text-ink-3 hover:text-ink">
                              ตั้งเป็นบัญชีหลัก
                            </button>
                          </form>
                        ) : null}
                        {a.archivedAt == null ? (
                          <form action={archiveAccount.bind(null, a.id)}>
                            <button className="px-1 text-xs text-ink-3 hover:text-bad">
                              ปิดบัญชี
                            </button>
                          </form>
                        ) : (
                          <form action={reopenAccount.bind(null, a.id)}>
                            <button className="px-1 text-xs text-ink-3 hover:text-ink">
                              เปิดใช้อีกครั้ง
                            </button>
                          </form>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="px-5 pb-4 text-xs leading-relaxed text-ink-3">
              ปิดบัญชีคือซ่อนจากรายการที่เลือกได้ — ประวัติทั้งหมดยังอยู่ครบและยังนับในงบ ·
              บัญชีที่มีรายการแล้วลบไม่ได้ เพราะรายการเหล่านั้นคือหลักฐานว่าเงินไปอยู่ที่ไหน
            </p>
          </Card>
        </>
      ) : null}

      {/* ═══ สมุดบัญชี ════════════════════════════════════════════════ */}
      {view === "ledger" ? (
        <>
          {/* account filter */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pr-1 text-xs text-ink-3">บัญชี</span>
              <Link
                href={hrefFor({ account: null, edit: null })}
                className={`rounded-full px-3 py-1.5 text-xs ${!accountId ? "bg-accent-soft font-semibold text-accent-text" : "text-ink-2 hover:text-ink"}`}
              >
                ทุกบัญชี
              </Link>
              {accounts.map((a) => (
                <Link
                  key={a.id}
                  href={hrefFor({ account: a.id, edit: null })}
                  className={`rounded-full px-3 py-1.5 text-xs ${accountId === a.id ? "bg-accent-soft font-semibold text-accent-text" : "text-ink-2 hover:text-ink"}`}
                >
                  {a.name}
                </Link>
              ))}
              {activeAccount ? (
                <span className="ml-auto text-xs text-ink-3">
                  ยอดคงเหลือ{" "}
                  <span className="num font-semibold text-ink">
                    {baht(activeAccount.balanceSatang)}
                  </span>
                </span>
              ) : null}
            </div>
          </Card>

          {/* add / edit form */}
          <Card>
            <CardHeader
              title={editing ? "แก้ไขรายการ" : "ลงรายการใหม่"}
              action={
                editing ? (
                  <LinkButton variant="ghost" href={hrefFor({ edit: null })}>
                    ยกเลิก
                  </LinkButton>
                ) : undefined
              }
            />
            <form
              action={
                editing
                  ? updateTransaction.bind(null, editing.id)
                  : createTransaction
              }
              className="grid grid-cols-2 gap-3 px-5 pb-5 md:grid-cols-4"
            >
              {(!editing || editing.origin === "manual") && (
                <>
                  <Field label="วันที่ *">
                    <Input type="date" name="date" defaultValue={editing?.date ?? today} required />
                  </Field>
                  <Field label="รายละเอียด *" className="col-span-2">
                    <Input name="description" defaultValue={editing?.description ?? ""} required />
                  </Field>
                  <Field label="ทิศทาง">
                    <Select name="direction" defaultValue={editing?.direction ?? "out"}>
                      <option value="in">เงินเข้า</option>
                      <option value="out">เงินออก</option>
                    </Select>
                  </Field>
                  <Field label="จำนวน (฿) *">
                    <Input name="amount" defaultValue={editing ? baht(Number(editing.amountSatang)) : ""} className="num" required />
                  </Field>
                </>
              )}
              {editing && editing.origin !== "manual" ? (
                <p className="col-span-2 self-center text-xs text-ink-3 md:col-span-4">
                  รายการนี้ระบบลงให้จากดีล — จำนวนและวันที่แก้ที่ตัวดีล ที่นี่แก้ได้เฉพาะบัญชี หมวด และเอกสาร
                </p>
              ) : null}
              {/* The account is editable even on a deal-posted row: the deal
                  knows a commission arrived, not which bank it landed in. */}
              <Field label="บัญชี *">
                <Select
                  name="accountId"
                  defaultValue={
                    editing?.accountId ??
                    accountId ??
                    openAccountList.find((a) => a.isDefault)?.id ??
                    openAccountList[0]?.id ??
                    ""
                  }
                >
                  {openAccountList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="หมวดบัญชี">
                <Select name="category" defaultValue={editing?.category ?? ""}>
                  <option value="">— ยังไม่จัดหมวด —</option>
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.key}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="ผูกกับดีล">
                <Select name="dealId" defaultValue={editing?.dealId ?? ""}>
                  <option value="">—</option>
                  {dealOpts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.listingName ?? o.legacyCode ?? o.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="ลิงก์ไฟล์/เอกสาร">
                <Input name="filesLink" defaultValue={editing?.filesLink ?? ""} placeholder="https://…" />
              </Field>
              <Field label="หมายเหตุ">
                <Input name="remark" defaultValue={editing?.remark ?? ""} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="hasReceipt" defaultChecked={editing?.hasReceipt ?? false} className="size-4 accent-[var(--accent)]" />
                มีใบเสร็จ
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isAnnual" defaultChecked={editing?.isAnnual ?? false} className="size-4 accent-[var(--accent)]" />
                จ่ายรายปี (เกลี่ยลง P&L)
              </label>
              <Field label="เกลี่ยกี่เดือน">
                <Input name="annualMonths" defaultValue={editing?.annualMonths ?? 12} className="num" />
              </Field>
              <div className="flex items-end justify-end">
                <Button type="submit">{editing ? "บันทึก" : "ลงรายการ"}</Button>
              </div>
            </form>
          </Card>

          {/* transfer */}
          {openAccountList.length > 1 ? (
            <Card>
              <CardHeader
                title="โอนระหว่างบัญชี"
                action={
                  <span className="text-xs text-ink-3">
                    ยอดของทั้งสองบัญชีขยับ แต่ไม่นับเป็นรายได้หรือค่าใช้จ่ายในงบ
                  </span>
                }
              />
              <form
                action={createTransfer}
                className="grid grid-cols-2 gap-3 px-5 pb-5 md:grid-cols-5"
              >
                <Field label="วันที่ *">
                  <Input type="date" name="date" defaultValue={today} required />
                </Field>
                <Field label="จากบัญชี *">
                  <Select name="fromAccountId" defaultValue={accountId ?? openAccountList[0]?.id}>
                    {openAccountList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="ไปบัญชี *">
                  <Select name="toAccountId" defaultValue={openAccountList[1]?.id}>
                    {openAccountList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="จำนวน (฿) *">
                  <Input name="amount" className="num" required />
                </Field>
                <div className="flex items-end justify-end">
                  <Button type="submit" variant="secondary">
                    โอน
                  </Button>
                </div>
                <Field label="หมายเหตุ" className="col-span-2 md:col-span-5">
                  <Input name="remark" placeholder="เช่น เติมเงินบัญชีค่าโฆษณา" />
                </Field>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title={`รายการ (${rows.length})`}
              action={
                activeAccount ? (
                  <span className="text-xs text-ink-3">{activeAccount.name}</span>
                ) : (
                  <span className="text-xs text-ink-3">
                    คงเหลือคือยอดของบัญชีในแถวนั้น ไม่ใช่ยอดรวม
                  </span>
                )
              }
            />
            {rows.length === 0 ? (
              <EmptyState title="ยังไม่มีรายการในช่วงนี้" hint="ลงรายการแรก หรือรอดีลที่รับคอมมิชชันแล้ว" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>วันที่</Th>
                    <Th>รายละเอียด</Th>
                    {!accountId ? <Th>บัญชี</Th> : null}
                    <Th>หมวด</Th>
                    <Th className="text-right">จำนวน</Th>
                    <Th className="text-right">คงเหลือ</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line/60">
                      <Td className="num whitespace-nowrap">{formatDate(r.date)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          {r.origin !== "manual" && r.dealId ? (
                            <Link href={`/deals/${r.dealId}`} className="hover:underline">
                              {r.description}
                            </Link>
                          ) : (
                            r.description
                          )}
                          {r.origin === "deal_revenue" || r.origin === "deal_payout" ? (
                            <Pill tone="info">จากดีล</Pill>
                          ) : null}
                          {r.origin === "transfer" ? <Pill tone="muted">โอนภายใน</Pill> : null}
                          {r.hasReceipt ? <Pill tone="muted">ใบเสร็จ</Pill> : null}
                          {r.isAnnual ? <Pill tone="muted">รายปี/{r.annualMonths}ด.</Pill> : null}
                        </div>
                      </Td>
                      {!accountId ? (
                        <Td className="text-ink-2">{r.accountName}</Td>
                      ) : null}
                      <Td
                        className={
                          r.origin === "transfer"
                            ? "text-ink-3"
                            : r.category
                              ? ""
                              : "text-warn"
                        }
                      >
                        {r.origin === "transfer"
                          ? "ไม่นับในงบ"
                          : (r.category ?? "ยังไม่จัดหมวด")}
                      </Td>
                      <Td className="text-right">
                        <Amount satang={Number(r.amountSatang)} dir={r.direction} />
                      </Td>
                      <Td className="num text-right text-ink-2">{baht(r.balanceSatang)}</Td>
                      <Td wrap className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={hrefFor({ edit: r.id })} className="text-xs text-ink-3 hover:text-ink">
                            แก้ไข
                          </Link>
                          {r.origin === "manual" ? (
                            <form action={archiveTransaction.bind(null, r.id)}>
                              <button className="px-1 text-xs text-ink-3 hover:text-bad">ซ่อน</button>
                            </form>
                          ) : null}
                          {/* Both legs together — hiding one would make the
                              company total short by the transfer amount. */}
                          {r.origin === "transfer" && r.transferGroupId ? (
                            <form action={archiveTransfer.bind(null, r.transferGroupId)}>
                              <button className="px-1 text-xs text-ink-3 hover:text-bad">
                                ซ่อนทั้งคู่
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
