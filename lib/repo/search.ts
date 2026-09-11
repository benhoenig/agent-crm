// Global search behind the sidebar box (⌘K) → /search.
//
// Scoping is NOT re-invented here: every query reuses the same WHERE fragments
// the list pages use (listingScope / leadScope / contactScope), so search can
// never surface a row the user couldn't reach by browsing. Projects are
// deliberately unscoped — they're the shared knowledge base (DATA_MODEL §3).
//
// Phone queries are normalized through lib/phone.ts before matching, so
// "081-234-5678" finds an owner stored as "0812345678".

import { and, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  contacts,
  leads,
  listings,
  projects,
  zones,
} from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { leadScope, listingScope } from "./scope";
import { contactScope } from "./contacts";
import { normalizePhone } from "@/lib/phone";

/** Per-section cap — enough to find the row, short enough to stay scannable. */
const LIMIT = 8;

export interface SearchHit {
  id: string;
  href: string;
  title: string;
  subtitle: string | null;
  meta: string | null;
}

export interface SearchResults {
  q: string;
  listings: SearchHit[];
  leads: SearchHit[];
  contacts: SearchHit[];
  projects: SearchHit[];
  total: number;
}

const EMPTY = (q: string): SearchResults => ({
  q,
  listings: [],
  leads: [],
  contacts: [],
  projects: [],
  total: 0,
});

/** Match a text column, plus the phone-normalized form when the query looks numeric. */
function phoneOr(column: Parameters<typeof ilike>[0], q: string): SQL | undefined {
  const digits = normalizePhone(q);
  return digits
    ? or(ilike(column, `%${q}%`), ilike(column, `%${digits}%`))
    : ilike(column, `%${q}%`);
}

export async function search(viewer: Viewer, rawQ: string): Promise<SearchResults> {
  const q = rawQ.trim();
  // One character matches nearly everything and just costs a table scan.
  if (q.length < 2) return EMPTY(q);
  const like = `%${q}%`;
  const db = getDb();

  const [listingRows, leadRows, contactRows, projectRows] = await Promise.all([
    db
      .select({
        id: listings.id,
        legacyCode: listings.legacyCode,
        listingName: listings.listingName,
        status: listings.status,
        unitNo: listings.unitNo,
        zoneName: zones.nameThai,
      })
      .from(listings)
      .leftJoin(zones, eq(listings.zoneId, zones.id))
      .where(
        and(
          listingScope(viewer),
          or(
            ilike(listings.listingName, like),
            ilike(listings.legacyCode, like),
            ilike(listings.streetSoi, like),
            ilike(listings.unitNo, like)
          )
        )
      )
      .limit(LIMIT),

    db
      .select({
        id: leads.id,
        contactName: contacts.name,
        contactPhone: contacts.phone,
        initialInterest: leads.initialInterest,
        pipelineStage: leads.pipelineStage,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(
        and(
          leadScope(viewer),
          or(
            ilike(contacts.name, like),
            phoneOr(contacts.phone, q),
            ilike(leads.initialInterest, like),
            ilike(leads.legacyCode, like)
          )
        )
      )
      .limit(LIMIT),

    db
      .select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phone,
        lineId: contacts.lineId,
      })
      .from(contacts)
      .where(
        and(
          contactScope(viewer),
          or(
            ilike(contacts.name, like),
            phoneOr(contacts.phone, q),
            ilike(contacts.lineId, like)
          )
        )
      )
      .limit(LIMIT),

    db
      .select({
        id: projects.id,
        nameEng: projects.nameEng,
        nameThai: projects.nameThai,
        developer: projects.developer,
        zoneName: zones.nameThai,
      })
      .from(projects)
      .leftJoin(zones, eq(projects.zoneId, zones.id))
      .where(
        or(
          ilike(projects.nameEng, like),
          ilike(projects.nameThai, like),
          ilike(projects.developer, like)
        )
      )
      .limit(LIMIT),
  ]);

  const results: SearchResults = {
    q,
    listings: listingRows.map((r) => ({
      id: r.id,
      href: `/listings/${r.id}`,
      title: r.listingName ?? r.legacyCode ?? "(ไม่มีชื่อ)",
      subtitle: [r.legacyCode, r.unitNo && `ห้อง ${r.unitNo}`, r.zoneName]
        .filter(Boolean)
        .join(" · ") || null,
      meta: r.status,
    })),
    leads: leadRows.map((r) => ({
      id: r.id,
      href: `/leads/${r.id}`,
      title: r.contactName ?? "(ไม่ระบุชื่อ)",
      subtitle: [r.contactPhone, r.initialInterest].filter(Boolean).join(" · ") || null,
      meta: r.pipelineStage,
    })),
    contacts: contactRows.map((r) => ({
      id: r.id,
      href: `/contacts/${r.id}`,
      title: r.name ?? "(ไม่ระบุชื่อ)",
      subtitle: [r.phone, r.lineId && `LINE ${r.lineId}`].filter(Boolean).join(" · ") || null,
      meta: null,
    })),
    projects: projectRows.map((r) => ({
      id: r.id,
      href: `/projects/${r.id}`,
      title: r.nameEng ?? r.nameThai ?? "(ไม่มีชื่อ)",
      subtitle: [r.nameThai !== r.nameEng ? r.nameThai : null, r.developer]
        .filter(Boolean)
        .join(" · ") || null,
      meta: r.zoneName,
    })),
    total: 0,
  };

  results.total =
    results.listings.length +
    results.leads.length +
    results.contacts.length +
    results.projects.length;
  return results;
}
