/* งานตรวจดีล — the closed-case board บัญชี works from (Ben, 2026-09-11:
   "add role บัญชี -> มีหน้ารวมเคสที่ปิด + recheck ความถูกต้อง").
 *
 * WHY THIS IS NOT JUST A FILTERED DEAL LIST. The sign-off itself already
 * existed — reviewDeal() has locked deals since the module shipped — and in
 * production it had been used exactly zero times across 39 closed deals. A
 * button nobody can find is not a control. What was missing was the WORKLIST:
 * somewhere that says which deals are waiting and, more usefully, which ones
 * are waiting because something about them does not add up.
 *
 * SO THE PAGE CHECKS, IT DOES NOT JUST LIST. Every rule below is a statement
 * two parts of this database make about the same money, where they disagree.
 * The biggest one was visible the moment the data was looked at: 27 of the 39
 * deals say `Com. Paid` and not one of them carries a วันรับคอม — and revenue
 * posts to the books on that date, so ฿0 of commission had ever reached the
 * ledger. That is not a reporting bug, it is the books being empty, and it is
 * the kind of thing a checklist finds and a list does not.
 *
 * FLAGS ARE NOT VERDICTS. Every rule here is "these two fields disagree",
 * never "this person did something wrong" — the fix is almost always a missing
 * date. The page says what disagrees and leaves the conclusion to the person
 * holding the bank statement.
 *
 * DEAD DEALS ARE SKIPPED ENTIRELY. A deal that fell through legitimately has
 * no receive date, no splits and no ledger row; running the rules over it
 * would fill the board with noise and teach the reader to scroll past it.
 */

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals } from "@/lib/db/schema";
import { dealScope } from "./scope";
import { roleKeys } from "./options";
import type { Viewer } from "@/lib/auth/session";
import { bahtStrToSatang } from "@/lib/ledger";

export type DealIssueCode =
  | "paid_no_receive_date"
  | "commission_not_posted"
  | "receive_date_no_commission"
  | "splits_exceed_commission"
  | "paid_leg_no_date"
  | "no_sales"
  | "no_closing_price"
  | "dates_out_of_order";

export type IssueSeverity = "high" | "medium";

export const DEAL_ISSUES: Record<
  DealIssueCode,
  { label: string; hint: string; severity: IssueSeverity }
> = {
  paid_no_receive_date: {
    label: "รับคอมแล้ว แต่ไม่มีวันรับคอม",
    hint: "สถานะบอกว่าได้รับค่าคอมแล้ว แต่ยังไม่ได้ใส่วันที่เงินเข้า — เงินก้อนนี้จึงยังไม่ถูกลงในสมุดบัญชีเลย",
    severity: "high",
  },
  commission_not_posted: {
    label: "มีวันรับคอม แต่ไม่มีรายการในสมุดบัญชี",
    hint: "ปกติระบบลงรายการให้เองเมื่อใส่วันรับคอม — ถ้าไม่มี แปลว่ามีคนซ่อนรายการนั้นไว้ หรือยังไม่มีบัญชีให้ลง",
    severity: "high",
  },
  splits_exceed_commission: {
    label: "ส่วนแบ่งรวมมากกว่าค่าคอม",
    hint: "ยอดที่แบ่งให้ทุกคนรวมกันเกินค่าคอมที่บริษัทได้รับ — ดีลนี้ขาดทุนตามตัวเลขที่กรอกไว้",
    severity: "high",
  },
  paid_leg_no_date: {
    label: "ติ๊กจ่ายแล้ว แต่ไม่มีวันที่จ่าย",
    hint: "ส่วนแบ่งที่จ่ายแล้วจะเข้าสมุดบัญชีตามวันที่จ่าย — ถ้าเว้นว่าง เงินที่จ่ายออกไปจะไม่ปรากฏในบัญชี",
    severity: "high",
  },
  receive_date_no_commission: {
    label: "มีวันรับคอม แต่ไม่มียอดคอม",
    hint: "บอกว่าเงินเข้าวันไหน แต่ไม่ได้บอกว่าเข้าเท่าไหร่",
    severity: "medium",
  },
  no_sales: {
    label: "ไม่มีเซลส์เจ้าของดีล",
    hint: "ดีลที่มีค่าคอมแต่ไม่มีชื่อเซลส์จะไม่ถูกนับในเป้าหมายหรือกระดานผลงานของใครเลย",
    severity: "medium",
  },
  no_closing_price: {
    label: "มีค่าคอม แต่ไม่มีราคาปิด",
    hint: "ตรวจเปอร์เซ็นต์ค่าคอมไม่ได้ถ้าไม่รู้ราคาที่ปิดจริง",
    severity: "medium",
  },
  dates_out_of_order: {
    label: "วันโอนมาก่อนวันปิด",
    hint: "โอนกรรมสิทธิ์ก่อนวันปิดการขาย — มักเป็นการพิมพ์ปีหรือเดือนสลับกัน",
    severity: "medium",
  },
};

export interface DealReviewRow {
  id: string;
  legacyCode: string | null;
  listingName: string | null;
  type: string | null;
  salesName: string | null;
  closingPrice: string | null;
  commission: string | null;
  closingStatus: string | null;
  closingDate: string | null;
  transferDate: string | null;
  receiveDate: string | null;
  reviewedAt: Date | null;
  reviewerName: string | null;
  legs: number;
  paidLegs: number;
  splitTotal: string | null;
  /** Live `deal_revenue` rows in the ledger — 0 or 1 by unique index. */
  revenueRows: number;
  issues: DealIssueCode[];
}

export interface DealReviewBoard {
  pending: DealReviewRow[];
  reviewed: DealReviewRow[];
  /** Every unreviewed row carrying at least one flag, worst first. */
  flagged: DealReviewRow[];
  summary: {
    pendingCount: number;
    reviewedCount: number;
    flaggedCount: number;
    highCount: number;
    /** Commission on live deals that has not reached the ledger, in satang. */
    unpostedSatang: number;
  };
}

interface RawRow {
  id: string;
  legacy_code: string | null;
  listing_name: string | null;
  type: string | null;
  sales_id: string | null;
  sales_name: string | null;
  reviewer_name: string | null;
  closing_price: string | null;
  commission: string | null;
  closing_status: string | null;
  closing_date: string | null;
  transfer_date: string | null;
  receive_date: string | null;
  reviewed_at: string | null;
  legs: number;
  paid_legs: number;
  paid_missing_date: number;
  split_total: string | null;
  revenue_rows: number;
}

/**
 * The whole board in ONE query plus one options lookup.
 *
 * The payout aggregate is a LATERAL rather than a GROUP BY over a join,
 * because the same query also needs one-per-deal facts (the ledger row count)
 * and grouping the deal row by four columns to get there is how a "total"
 * quietly becomes a multiple of the number of splits.
 *
 * dealScope() is applied even though every role that can open this page holds
 * deals: "all" today. The page's gate is dealReview and the scope is deals —
 * two different permissions, and nothing stops a future custom role from
 * holding one without the other.
 */
export async function dealReviewBoard(viewer: Viewer): Promise<DealReviewBoard> {
  const [deadKeys, settledKeys] = await Promise.all([
    roleKeys("closing_status", "dead"),
    roleKeys("closing_status", "settled"),
  ]);

  const scope = dealScope(viewer);
  const res = await getDb().execute(sql`
    select
      d.id, d.legacy_code, d.type, d.sales_id,
      d.closing_price::text as closing_price,
      d.commission::text as commission,
      d.closing_status, d.closing_date::text as closing_date,
      d.transfer_date::text as transfer_date,
      d.receive_date::text as receive_date,
      d.reviewed_at::text as reviewed_at,
      u.name as sales_name,
      ru.name as reviewer_name,
      coalesce(l.listing_name, l.legacy_code) as listing_name,
      p.legs, p.paid_legs, p.paid_missing_date, p.split_total::text as split_total,
      (
        select count(*)::int from transactions t
        where t.deal_id = d.id and t.origin = 'deal_revenue' and t.archived_at is null
      ) as revenue_rows
    from ${deals} d
    left join users u on u.id = d.sales_id
    left join users ru on ru.id = d.reviewed_by
    left join listings l on l.id = d.listing_id
    left join lateral (
      select
        count(*)::int as legs,
        count(*) filter (where dp.paid)::int as paid_legs,
        count(*) filter (where dp.paid and dp.paid_date is null)::int as paid_missing_date,
        coalesce(sum(dp.amount), 0) as split_total
      from deal_payouts dp where dp.deal_id = d.id
    ) p on true
    ${scope ? sql`where ${scope}` : sql``}
    order by d.closing_date desc nulls last, d.created_at desc
  `);

  const raw = res.rows as unknown as RawRow[];

  const rows: DealReviewRow[] = raw.map((r) => {
    const dead = r.closing_status != null && deadKeys.includes(r.closing_status);
    const settled =
      r.closing_status != null && settledKeys.includes(r.closing_status);
    const commission = bahtStrToSatang(r.commission) ?? 0;
    const splitTotal = bahtStrToSatang(r.split_total) ?? 0;
    const closingPrice = bahtStrToSatang(r.closing_price) ?? 0;

    const issues: DealIssueCode[] = [];
    if (!dead) {
      if (settled && !r.receive_date) issues.push("paid_no_receive_date");
      if (r.receive_date && commission > 0 && r.revenue_rows === 0)
        issues.push("commission_not_posted");
      if (r.receive_date && commission <= 0)
        issues.push("receive_date_no_commission");
      if (commission > 0 && splitTotal > commission)
        issues.push("splits_exceed_commission");
      if (r.paid_missing_date > 0) issues.push("paid_leg_no_date");
      if (commission > 0 && !r.sales_id) issues.push("no_sales");
      if (commission > 0 && closingPrice <= 0) issues.push("no_closing_price");
      if (
        r.closing_date &&
        r.transfer_date &&
        r.transfer_date < r.closing_date
      )
        issues.push("dates_out_of_order");
    }

    return {
      id: r.id,
      legacyCode: r.legacy_code,
      listingName: r.listing_name,
      type: r.type,
      salesName: r.sales_name,
      closingPrice: r.closing_price,
      commission: r.commission,
      closingStatus: r.closing_status,
      closingDate: r.closing_date,
      transferDate: r.transfer_date,
      receiveDate: r.receive_date,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at) : null,
      reviewerName: r.reviewer_name,
      legs: r.legs,
      paidLegs: r.paid_legs,
      splitTotal: r.split_total,
      revenueRows: r.revenue_rows,
      issues,
    };
  });

  const pending = rows.filter((r) => r.reviewedAt == null);
  const reviewed = rows.filter((r) => r.reviewedAt != null);

  const worst = (r: DealReviewRow) =>
    r.issues.some((i) => DEAL_ISSUES[i].severity === "high") ? 0 : 1;
  const flagged = pending
    .filter((r) => r.issues.length > 0)
    .sort((a, b) => worst(a) - worst(b) || b.issues.length - a.issues.length);

  // Commission that exists as a promise on a deal but not as a row in the
  // books. Counted over LIVE deals only and over every unreviewed one, whether
  // or not it carries a flag: this is the gap between "we earned it" and "it
  // is in the ledger", which is the single number this page exists to shrink.
  const unpostedSatang = rows
    .filter((r) => r.revenueRows === 0)
    .filter(
      (r) =>
        !(r.closingStatus != null && deadKeys.includes(r.closingStatus))
    )
    .reduce((n, r) => n + (bahtStrToSatang(r.commission) ?? 0), 0);

  return {
    pending,
    reviewed,
    flagged,
    summary: {
      pendingCount: pending.length,
      reviewedCount: reviewed.length,
      flaggedCount: flagged.length,
      highCount: flagged.filter((r) =>
        r.issues.some((i) => DEAL_ISSUES[i].severity === "high")
      ).length,
      unpostedSatang,
    },
  };
}
