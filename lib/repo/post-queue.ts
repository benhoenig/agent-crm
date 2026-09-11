// รอโพสต์ — the listings support has to put on the portals.
//
// DERIVED FROM STATUS, NOT FROM A QUEUE TABLE. The obvious alternative was to
// log a pending row into listing_updates when a listing goes ready, the way
// the off-portals handoff already does (listings/actions.ts auditListingEdit).
// That was rejected: a logged queue only ever contains listings that
// TRANSITIONED after the feature shipped, it holds nothing for the listing
// already sitting in รอโพสต์ today, and a row resolved by mistake is gone for
// good. Asking the listings table "who is in this status right now" cannot
// drift from the truth, needs no backfill, and repairs itself the moment
// somebody fixes a status. Same reasoning the repost queue is built on
// (schema/property.ts repostRules: "Nothing to reset, nothing that can
// drift").
//
// SCOPED ANYWAY. Every role that can open this page holds listings:"all", so
// listingScope() is a no-op for them today. It is in the WHERE regardless —
// the page's gate is a permission, the row filter is a scope, and the day
// somebody grants listingUpdateQueue to a narrower role this keeps answering
// correctly instead of leaking the whole book.

import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  listingChannels,
  listingMedia,
  listings,
  listingUpdates,
  projects,
  users,
  zones,
} from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { listingScope } from "./scope";
import { hasRole, roleKeys } from "./options";
import type { CopySource } from "@/lib/copy-render";

export interface PostQueueChannel {
  channel: string;
  url: string | null;
}

export interface PostQueueRow {
  id: string;
  listingName: string | null;
  legacyCode: string | null;
  status: string;
  potential: string | null;
  agentName: string | null;
  projectName: string | null;
  /** Photos/videos in the R2 gallery — support cannot post without them, so
      a zero here is the single most useful warning on the row. */
  mediaCount: number;
  /** URLs already pasted, one per portal that has a row. */
  channels: PostQueueChannel[];
  /** When the listing entered this status, from the status audit trail.
      Null when it was never logged — imported rows, mostly. */
  readySince: Date | null;
  /** Everything the copy generator needs, so the page can render the post
      text for every row without a query per row. */
  source: CopySource;
}

/** Just the number, for the tab badge — no joins, no rows. */
export async function postQueueCount(viewer: Viewer): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(listings)
    .where(
      and(
        hasRole(listings.status, "listing_status", "ready_to_post"),
        listingScope(viewer)
      )
    );
  return row?.n ?? 0;
}

/**
 * The queue, oldest-waiting first.
 *
 * NO PAGINATION, DELIBERATELY. This is a work list that is meant to reach
 * zero — a healthy day has single digits in it, and the whole point is that
 * support can see the bottom of it. If it ever grows past a screenful that is
 * a staffing signal, not a paging problem, and hiding the tail behind page 2
 * would be the surest way to stop anyone noticing.
 */
export async function postQueue(viewer: Viewer): Promise<PostQueueRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: listings.id,
      listingName: listings.listingName,
      legacyCode: listings.legacyCode,
      status: listings.status,
      potential: listings.potential,
      listingType: listings.listingType,
      bed: listings.bed,
      bath: listings.bath,
      usableSqm: listings.usableSqm,
      floor: listings.floor,
      building: listings.building,
      parking: listings.parking,
      direction: listings.direction,
      view: listings.view,
      askingPrice: listings.askingPrice,
      rentalPrice: listings.rentalPrice,
      priceRemark: listings.priceRemark,
      postRemark: listings.postRemark,
      createdAt: listings.createdAt,
      agentName: sql<string | null>`coalesce(${users.nickname}, ${users.name})`,
      projectEng: projects.nameEng,
      projectThai: projects.nameThai,
      zoneThai: zones.nameThai,
      zoneEng: zones.nameEng,
    })
    .from(listings)
    .leftJoin(users, eq(users.id, listings.agentId))
    .leftJoin(projects, eq(projects.id, listings.projectId))
    .leftJoin(zones, eq(zones.id, listings.zoneId))
    .where(
      and(
        hasRole(listings.status, "listing_status", "ready_to_post"),
        listingScope(viewer)
      )
    )
    .orderBy(asc(listings.createdAt));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  /* Three side queries over the same id set rather than three joins on the
     main one: media and channels are both one-to-many, so joining them
     together would multiply rows and make every listing field arrive N×M
     times to be de-duplicated in JS anyway. */
  const readyKeys = await roleKeys("listing_status", "ready_to_post");
  const [channelRows, mediaRows, readyRows] = await Promise.all([
    db
      .select({
        listingId: listingChannels.listingId,
        channel: listingChannels.channel,
        url: listingChannels.url,
      })
      .from(listingChannels)
      .where(inArray(listingChannels.listingId, ids))
      .orderBy(asc(listingChannels.channel)),
    db
      .select({ listingId: listingMedia.listingId, n: count() })
      .from(listingMedia)
      .where(inArray(listingMedia.listingId, ids))
      .groupBy(listingMedia.listingId),
    // The most recent "somebody set this listing to ready" entry. Reading the
    // audit trail rather than listings.updatedAt on purpose: updatedAt moves
    // when anyone touches any column, so a listing that has waited a week
    // would claim to have arrived the moment its price was corrected.
    readyKeys.length > 0
      ? db
          .select({
            listingId: listingUpdates.listingId,
            at: sql<Date>`max(coalesce(${listingUpdates.editedAt}, ${listingUpdates.createdAt}))`,
          })
          .from(listingUpdates)
          .where(
            and(
              inArray(listingUpdates.listingId, ids),
              eq(listingUpdates.columnName, "status"),
              inArray(listingUpdates.newValue, readyKeys)
            )
          )
          .groupBy(listingUpdates.listingId)
      : Promise.resolve([] as { listingId: string; at: Date }[]),
  ]);

  const channelsBy = new Map<string, PostQueueChannel[]>();
  for (const c of channelRows) {
    const list = channelsBy.get(c.listingId) ?? [];
    list.push({ channel: c.channel, url: c.url });
    channelsBy.set(c.listingId, list);
  }
  const mediaBy = new Map(mediaRows.map((m) => [m.listingId, m.n]));
  const readyBy = new Map(readyRows.map((r) => [r.listingId, r.at]));

  return rows.map((r) => ({
    id: r.id,
    listingName: r.listingName,
    legacyCode: r.legacyCode,
    status: r.status,
    potential: r.potential,
    agentName: r.agentName,
    projectName: r.projectThai ?? r.projectEng,
    mediaCount: mediaBy.get(r.id) ?? 0,
    channels: channelsBy.get(r.id) ?? [],
    readySince: readyBy.get(r.id) ?? null,
    source: {
      legacyCode: r.legacyCode,
      listingType: r.listingType,
      potential: r.potential,
      projectEng: r.projectEng,
      projectThai: r.projectThai,
      zoneName: r.zoneThai ?? r.zoneEng,
      postRemark: r.postRemark,
      bed: r.bed,
      bath: r.bath,
      usableSqm: r.usableSqm,
      floor: r.floor,
      building: r.building,
      parking: r.parking,
      direction: r.direction,
      view: r.view,
      askingPrice: r.askingPrice,
      rentalPrice: r.rentalPrice,
      priceRemark: r.priceRemark,
    },
  }));
}
