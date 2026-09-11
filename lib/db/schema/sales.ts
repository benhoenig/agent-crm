import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { dealDocType, pipelineStage } from "./enums";
import { users } from "./auth";
import { zones } from "./master";
import { contacts } from "./contacts";
import { listings, projects } from "./property";

// Active Lead (32 cols) + Lead Submission intake, one row per case.
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyCode: text("legacy_code").unique(),
    contactId: uuid("contact_id").references(() => contacts.id),
    listingId: uuid("listing_id").references(() => listings.id),
    initialInterest: text("initial_interest"), // free-text "Initial Interested"
    leadType: text("lead_type"), // options "lead_type"
    source: text("source"), // options "marketing_channel"
    contactBy: text("contact_by"), // options "contact_by"
    potential: text("potential"), // options "lead_potential"
    leadStatus: text("lead_status").notNull().default("Active"), // options "lead_status"
    pipelineStage: pipelineStage("pipeline_stage").notNull().default("Lead"),
    progress: text("progress"),
    background: text("background"),
    requirement: text("requirement"),
    painPoint: text("pain_point"),
    budgetMillion: numeric("budget_million", { precision: 8, scale: 2 }),
    timeline: text("timeline"),
    lastFollowedAt: date("last_followed_at"),
    activityComment: text("activity_comment"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    createdBy: uuid("created_by").references(() => users.id),

    // intake metadata (historic LINE flow imports here; flow itself retires)
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lineUserId: text("line_user_id"),
    assignedBy: uuid("assigned_by").references(() => users.id),
    complain: text("complain"),
    complainSeverity: text("complain_severity"), // options "complain_severity"
    complainStatus: text("complain_status"), // options "complain_status"

    // case closing
    commission: numeric("commission", { precision: 12, scale: 2 }),
    bankLoan: text("bank_loan"),
    closingUnit: text("closing_unit"),
    closingDate: date("closing_date"),
    transferDate: date("transfer_date"),
    closingRemark: text("closing_remark"),
    caseStatus: text("case_status"), // options "case_status"

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("leads_assigned_to_idx").on(t.assignedTo),
    index("leads_pipeline_stage_idx").on(t.pipelineStage),
    index("leads_contact_idx").on(t.contactId),
    index("leads_listing_idx").on(t.listingId),
  ]
);

// Closed-deal ledger from _raw_revenue. Buyer/seller legal identity is PII —
// admin-scoped in the query layer, never exposed to other roles.
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyCode: text("legacy_code").unique(),
    listingId: uuid("listing_id").references(() => listings.id),
    leadId: uuid("lead_id").references(() => leads.id), // historic rows won't all link
    type: text("type"), // sale/rent vocabulary from _raw_revenue kept verbatim
    closingPrice: numeric("closing_price", { precision: 14, scale: 2 }),
    commission: numeric("commission", { precision: 12, scale: 2 }),
    salesId: uuid("sales_id").references(() => users.id),
    coAgent: text("co_agent"),
    closingDate: date("closing_date"),
    transferDate: date("transfer_date"),
    closingStatus: text("closing_status"), // options "closing_status"
    /** When the commission ARRIVED (bank date). Revenue posts to the ledger
        on this date, not the closing date — a deal closed in March and paid
        in June is June's money. */
    receiveDate: date("receive_date"),
    reservationAmount: numeric("reservation_amount", {
      precision: 12,
      scale: 2,
    }),
    buyerFullname: text("buyer_fullname"),
    buyerAddress: text("buyer_address"),
    buyerIdNo: text("buyer_id_no"),
    sellerFullname: text("seller_fullname"),
    sellerAddress: text("seller_address"),
    sellerIdNo: text("seller_id_no"),
    remark: text("remark"),

    /** Sign-off (Klaichan's "Nut enters, Cream reviews" loop). A reviewed
        deal is LOCKED — edits are refused until a reviewer reopens it, so
        "ตรวจแล้ว" means the numbers have not moved since. */
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("deals_sales_idx").on(t.salesId),
    index("deals_listing_idx").on(t.listingId),
  ]
);

// Commission split legs — who gets what out of a deal's commission.
// Whole-set semantics on write (delete + re-insert in one statement, no
// interactive transactions on Neon HTTP), so nothing here is referenced by
// id from elsewhere: the ledger keys payout rows by (deal, role) instead.
export const dealPayouts = pgTable(
  "deal_payouts",
  {
    id: serial("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // options "payout_role"
    /** Free text — an external co-agent or outsource has no users row. */
    payeeName: text("payee_name"),
    payeeUserId: uuid("payee_user_id").references(() => users.id),
    pct: doublePrecision("pct"),
    amount: numeric("amount", { precision: 12, scale: 2 }), // baht
    paid: boolean("paid").notNull().default(false),
    paidDate: date("paid_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("deal_payouts_deal_idx").on(t.dealId)]
);

// The accounts the money actually sits in (Ben, 2026-09-11: "เพิ่ม account
// transaction อีกอัน -> show รวมเป็น dashboard ได้").
//
// THE LEDGER USED TO ASSUME ONE. `transactions` had no account column and the
// balance card said "ยอดคงเหลือ (ทั้งบัญชี)" — true only while there was
// exactly one. An agency runs at least two in practice (the company account
// and the director's, which is where a loan in or a drawing out goes), and
// adding them up without knowing which is which produces a number that
// reconciles against nothing.
//
// OPENING BALANCE IS NOT OPTIONAL. A real bank account has money in it before
// the CRM knows it exists, so a running balance that starts at zero disagrees
// with the statement forever and the disagreement is silent. One number per
// account, entered once, and every balance in the app is opening + movement.
//
// ARCHIVE, NEVER DELETE, and the foreign key from transactions is deliberately
// left at RESTRICT: an account with history cannot be removed, because the
// rows pointing at it are claims about where money went.
export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** bank · cash (เงินสดย่อย) · other. Display grouping only — every kind
        behaves identically in the balance and the P&L. */
    kind: text("kind").$type<"bank" | "cash" | "other">().notNull().default("bank"),
    bankName: text("bank_name"),
    /** Free text. Store what the bookkeeper needs to recognise the account on
        a statement — the last four digits are usually enough and are what the
        form asks for; nothing in the app reads this. */
    accountNo: text("account_no"),
    /** The balance on the day this account entered the CRM. Satang, signed:
        an account can legitimately open overdrawn. */
    openingBalanceSatang: bigint("opening_balance_satang", { mode: "number" })
      .notNull()
      .default(0),
    /** The day `openingBalanceSatang` was true — shown next to it so nobody
        has to guess what the number is the balance AS OF. */
    openingDate: date("opening_date"),
    /** Where a hand-typed row and a deal's commission land unless told
        otherwise. Exactly one account holds this (enforced below). */
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    note: text("note"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // AT MOST ONE DEFAULT, enforced by the database rather than by whichever
    // code path happens to set it. Two defaults would make "which account did
    // this commission post to" answerable two ways.
    uniqueIndex("ledger_accounts_default_idx")
      .on(t.isDefault)
      .where(sql`${t.isDefault}`),
  ]
);

// The cash ledger — a bank account, not an accrual book (ported from the
// Klaichan/Mook ledger, lib/ledger.ts holds the P&L that reads it).
// Money is SATANG in a bigint: int4 overflows at ฿21.47M and a director
// loan or a big transfer can plausibly cross that.
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The day the money moved — a bank-statement date. */
    date: date("date").notNull(),
    description: text("description").notNull(),
    /** "in" = เงินเข้า, "out" = เงินออก. One amount + a direction, because a
        row is never both and two columns make that representable. */
    direction: text("direction").$type<"in" | "out">().notNull(),
    /** Always positive. Satang. */
    amountSatang: bigint("amount_satang", { mode: "number" }).notNull(),
    /** options "ledger_category". Nullable — a row typed in a hurry beats no
        row — but the P&L counts the uncategorised out loud. */
    category: text("category"),

    /** WHICH account the money moved in or out of. NOT NULL: a transaction
        with no account is a balance that belongs to nobody, and once two
        accounts exist there is no safe default to read it as. RESTRICT on
        delete — see ledgerAccounts. */
    accountId: uuid("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    /** The two legs of a โอนระหว่างบัญชี share this. Money moving between the
        company's own accounts is neither income nor expense — it never left
        the business — so the P&L skips these rows entirely (see
        lib/repo/ledger.ts) while both balances still move. Without it the
        obvious way to record a transfer is one "out" and one "in", which
        inflates revenue and expenses by the same amount and quietly ruins
        every margin on the statement. */
    transferGroupId: uuid("transfer_group_id"),

    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    listingId: uuid("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),

    /** 'manual' = typed by hand; 'transfer' = one leg of a move between the
        company's own accounts (paired by transferGroupId, excluded from the
        P&L); the other two are posted and maintained by
        lib/repo/deal-ledger.ts, which owns their amount and date. */
    origin: text("origin")
      .$type<"manual" | "transfer" | "deal_revenue" | "deal_payout">()
      .notNull()
      .default("manual"),
    /** For 'deal_payout' rows: which split leg this pays — the payout ROLE,
        not the deal_payouts.id, because payout writes are whole-set
        delete+insert and mint new ids every save. One leg per role per deal. */
    payoutRole: text("payout_role"),

    hasReceipt: boolean("has_receipt").notNull().default(false),
    filesLink: text("files_link"),
    remark: text("remark"),

    /** Annual prepayment — spread over annualMonths from `date` in the P&L
        instead of cratering one month. */
    isAnnual: boolean("is_annual").notNull().default(false),
    annualMonths: integer("annual_months").notNull().default(12),

    createdBy: uuid("created_by").references(() => users.id),
    /** Archive, never delete — a ledger row is a claim about a bank account. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("transactions_date_idx").on(t.date),
    index("transactions_deal_idx").on(t.dealId),
    // Every balance and every ledger page reads one account over a date
    // window; the running-balance window function orders by exactly this.
    index("transactions_account_date_idx").on(t.accountId, t.date),
    index("transactions_transfer_idx").on(t.transferGroupId),
    // One revenue row per deal, one row per payout leg — a retried sync must
    // not post the same commission twice.
    uniqueIndex("transactions_deal_revenue_idx")
      .on(t.dealId)
      .where(sql`${t.origin} = 'deal_revenue'`),
    uniqueIndex("transactions_payout_idx")
      .on(t.dealId, t.payoutRole)
      .where(sql`${t.origin} = 'deal_payout'`),
  ]
);

// Deal document vault: R2 keys + legacy Drive URLs (DATA_MODEL §6).
export const dealDocuments = pgTable(
  "deal_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    docType: dealDocType("doc_type").notNull(),
    r2Key: text("r2_key"),
    sourceDriveUrl: text("source_drive_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("deal_documents_deal_idx").on(t.dealId)]
);

// Market-intelligence log: units that closed (by us or not), 16-col version.
export const lastMatches = pgTable(
  "last_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salesId: uuid("sales_id").references(() => users.id),
    type: text("type"), // options "last_match_type"
    matchedAt: date("matched_at"),
    projectName: text("project_name"),
    projectId: uuid("project_id").references(() => projects.id),
    potential: text("potential"), // options "listing_potential"
    propertyType: text("property_type"), // options "property_type"
    zoneId: uuid("zone_id").references(() => zones.id),
    price: numeric("price", { precision: 14, scale: 2 }),
    bed: smallint("bed"),
    bath: smallint("bath"),
    sqm: numeric("sqm", { precision: 10, scale: 2 }),
    floor: text("floor"),
    tower: text("tower"),
    direction: text("direction"), // options "direction"
    remark: text("remark"),
    buyerPersona: text("buyer_persona"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("last_matches_sales_idx").on(t.salesId)]
);
