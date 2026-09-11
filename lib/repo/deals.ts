// Deals repository — every read goes through dealScope(viewer).
//
// PII rule (DATA_MODEL §5): buyer/seller legal identity (fullname, address,
// ID no.) is admin-scoped. getDeal strips those columns server-side unless
// canSeeDealPII(viewer) — they never reach a non-admin render, RSC payload
// included.

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  contacts,
  dealDocuments,
  dealPayouts,
  deals,
  leads,
  listings,
  users,
} from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { canSeeDealPII, dealScope, listingScope } from "./scope";
import { lacksRole } from "./options";

export const DEALS_PAGE_SIZE = 25;

/**
 * The ONE definition of "commission still outstanding": everything not yet
 * tagged `settled` ("Com. Paid" in the seed catalog), including deals with no
 * closing status at all (common for imported _raw_revenue rows). Role-based
 * so renaming the status in Settings can't change what is counted. Dashboard
 * and /deals must agree on money.
 */
export const outstandingCommission = lacksRole(
  deals.closingStatus,
  "closing_status",
  "settled"
);

export interface DealFilters {
  q?: string;
  closingStatus?: string;
  year?: number;
  salesId?: string;
  page?: number;
}

/** Shared WHERE for list + totals. Assumes `listings` is left-joined (q). */
function dealWhere(viewer: Viewer, f: DealFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [dealScope(viewer)];
  if (f.q) {
    const like = `%${f.q}%`;
    parts.push(
      or(
        ilike(deals.legacyCode, like),
        ilike(deals.coAgent, like),
        ilike(listings.listingName, like),
        ilike(listings.legacyCode, like)
      )
    );
  }
  if (f.closingStatus)
    parts.push(eq(deals.closingStatus, f.closingStatus as never));
  if (f.year)
    parts.push(sql`extract(year from ${deals.closingDate}) = ${f.year}`);
  if (f.salesId) parts.push(eq(deals.salesId, f.salesId));
  // and() drops undefined and returns undefined for none
  return and(...parts);
}

export async function listDeals(viewer: Viewer, f: DealFilters) {
  const db = getDb();
  const where = dealWhere(viewer, f);
  const page = Math.max(1, f.page ?? 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: deals.id,
        legacyCode: deals.legacyCode,
        type: deals.type,
        closingPrice: deals.closingPrice,
        commission: deals.commission,
        closingDate: deals.closingDate,
        transferDate: deals.transferDate,
        closingStatus: deals.closingStatus,
        listingName: listings.listingName,
        listingLegacyCode: listings.legacyCode,
        salesName: users.name,
      })
      .from(deals)
      .leftJoin(listings, eq(deals.listingId, listings.id))
      .leftJoin(users, eq(deals.salesId, users.id))
      .where(where)
      .orderBy(desc(deals.closingDate), desc(deals.createdAt))
      .limit(DEALS_PAGE_SIZE)
      .offset((page - 1) * DEALS_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(deals)
      .leftJoin(listings, eq(deals.listingId, listings.id))
      .where(where),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / DEALS_PAGE_SIZE)),
  };
}

/** KPI row over the *filtered* set (same filters as listDeals, minus page). */
export async function dealTotals(
  viewer: Viewer,
  f: Omit<DealFilters, "page">
) {
  const where = dealWhere(viewer, f);
  const [row] = await getDb()
    .select({
      dealCount: count(),
      closingSum: sql<string | null>`sum(${deals.closingPrice})`,
      commissionSum: sql<string | null>`sum(${deals.commission})`,
      // ค้างรับ: commission on deals not yet "Com. Paid" (null status counts).
      commissionOutstanding: sql<
        string | null
      >`sum(${deals.commission}) filter (where ${outstandingCommission})`,
    })
    .from(deals)
    .leftJoin(listings, eq(deals.listingId, listings.id))
    .where(where);
  return row;
}

export async function getDeal(viewer: Viewer, id: string) {
  const db = getDb();
  const [row] = await db
    .select({
      deal: deals,
      listing: {
        id: listings.id,
        listingName: listings.listingName,
        legacyCode: listings.legacyCode,
      },
      // Lead link is nullable — historic _raw_revenue rows won't all link.
      leadContactName: contacts.name,
      salesName: users.name,
    })
    .from(deals)
    .leftJoin(listings, eq(deals.listingId, listings.id))
    .leftJoin(leads, eq(deals.leadId, leads.id))
    .leftJoin(contacts, eq(leads.contactId, contacts.id))
    .leftJoin(users, eq(deals.salesId, users.id))
    .where(and(eq(deals.id, id), dealScope(viewer)))
    .limit(1);

  if (!row) return null;

  // PII stripped in the repo, not the page: non-admins never receive the
  // buyer/seller legal identity columns at all (DATA_MODEL §5).
  const piiVisible = canSeeDealPII(viewer);
  const deal = piiVisible
    ? row.deal
    : {
        ...row.deal,
        buyerFullname: null,
        buyerAddress: null,
        buyerIdNo: null,
        sellerFullname: null,
        sellerAddress: null,
        sellerIdNo: null,
      };
  return { ...row, deal, piiVisible };
}

export async function getDealDocuments(dealId: string) {
  return getDb()
    .select()
    .from(dealDocuments)
    .where(eq(dealDocuments.dealId, dealId))
    .orderBy(asc(dealDocuments.docType), asc(dealDocuments.sortOrder));
}

/**
 * Listing options for the deal form — only listings the viewer can see,
 * capped to the most recently touched rows so the form payload stays bounded
 * after the import. No status filter: the listing a deal closes on has
 * usually just moved to ขายแล้ว/เช่าแล้ว, and recent ordering keeps it on top.
 * A search-based picker is the eventual replacement.
 */
export async function listingOptionsForDeal(viewer: Viewer, limit = 200) {
  return getDb()
    .select({
      id: listings.id,
      listingName: listings.listingName,
      legacyCode: listings.legacyCode,
    })
    .from(listings)
    .where(listingScope(viewer))
    .orderBy(desc(listings.updatedAt))
    .limit(limit);
}

/** A deal's payout legs, in insertion order. */
export async function getDealPayouts(dealId: string) {
  return getDb()
    .select()
    .from(dealPayouts)
    .where(eq(dealPayouts.dealId, dealId))
    .orderBy(asc(dealPayouts.id));
}
