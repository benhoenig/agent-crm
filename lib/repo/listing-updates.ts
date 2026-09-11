// /listing-updates repository — the change-request queue + field-level audit
// trail over listing_updates. Pages gate on perms.listingUpdateQueue.

import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  listings,
  listingUpdates,
  listingUpdateStatus,
  users,
} from "@/lib/db/schema";

const PAGE_SIZE = 50;

export type ListingUpdateStatus =
  (typeof listingUpdateStatus.enumValues)[number];

/** Thai labels for the audited listing columns (falls back to the raw key). */
export const LISTING_FIELD_LABEL: Record<string, string> = {
  legacyCode: "รหัสทรัพย์",
  status: "สถานะ",
  potential: "เกรด",
  listingType: "ประเภทประกาศ",
  listingName: "ชื่อทรัพย์",
  agentId: "ผู้ดูแล",
  zoneId: "โซน",
  projectId: "โครงการ",
  propertyType: "ประเภททรัพย์",
  inProject: "ในโครงการ",
  streetSoi: "ถนน/ซอย",
  locationGrade: "เกรดทำเล",
  btsStationId: "BTS",
  mrtStationId: "MRT",
  arlStationId: "ARL",
  unitTypeName: "แบบห้อง",
  unitNo: "เลขห้อง",
  bed: "นอน",
  bath: "น้ำ",
  maidRoom: "ห้องแม่บ้าน",
  landRai: "ที่ดิน (ไร่)",
  landNgan: "ที่ดิน (งาน)",
  landWa: "ที่ดิน (วา)",
  usableSqm: "พื้นที่ใช้สอย",
  floor: "ชั้น",
  building: "ตึก",
  view: "วิว",
  direction: "ทิศ",
  position: "ตำแหน่ง",
  parking: "จอดรถ",
  unitCondition: "สภาพห้อง",
  askingPrice: "ราคาขาย",
  rentalPrice: "ราคาเช่า",
  priceRemark: "เงื่อนไขราคา",
  listedAt: "วันที่รับทรัพย์",
  postedAt: "วันที่โพสต์",
  closedAt: "วันที่ปิด",
  lastFollowedAt: "ตามล่าสุด",
  ownerTalkCount: "คุยเจ้าของ (ครั้ง)",
  postRemark: "หมายเหตุโพสต์",
  remarkCream: "Remark ภายใน",
  googleMapsLink: "Google Maps",
};

export interface ListingUpdateFilters {
  status?: ListingUpdateStatus;
  page?: number;
}

export async function listListingUpdates(filters: ListingUpdateFilters = {}) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const where = filters.status
    ? eq(listingUpdates.status, filters.status)
    : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: listingUpdates.id,
        listingId: listingUpdates.listingId,
        listingCode: listings.legacyCode,
        listingName: listings.listingName,
        editedAt: listingUpdates.editedAt,
        createdAt: listingUpdates.createdAt,
        columnName: listingUpdates.columnName,
        oldValue: listingUpdates.oldValue,
        newValue: listingUpdates.newValue,
        status: listingUpdates.status,
        requestedByName: users.name,
        requestedByNickname: users.nickname,
      })
      .from(listingUpdates)
      .innerJoin(listings, eq(listingUpdates.listingId, listings.id))
      .leftJoin(users, eq(listingUpdates.requestedBy, users.id))
      .where(where)
      .orderBy(desc(listingUpdates.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(listingUpdates).where(where),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Row counts per status for the tab strip. */
export async function getListingUpdateCounts() {
  const rows = await getDb()
    .select({ status: listingUpdates.status, n: count() })
    .from(listingUpdates)
    .groupBy(listingUpdates.status);
  const byStatus = new Map(rows.map((r) => [r.status as string, r.n]));
  const get = (s: string) => byStatus.get(s) ?? 0;
  return {
    pending: get("pending"),
    approved: get("approved"),
    rejected: get("rejected"),
    applied: get("applied"),
    all: rows.reduce((sum, r) => sum + r.n, 0),
  };
}
