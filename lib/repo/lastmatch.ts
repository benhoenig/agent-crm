// Last Match repository — market-intelligence log of units that closed
// (by us or not).
//
// THE own/ทีม/ทั้งหมด TOGGLE IS NOW CAPPED BY A PERMISSION (Ben, 2026-09-11:
// "ให้แค่ทีม leader เห็น"). It used to be a pure user preference "applied on
// top of nothing else: the log is meant to be shared intel" — which meant any
// logged-in person could click ทั้งหมด and read every closed price and buyer
// persona the company has. That is the most portable data in this database.
//
// The cap lives HERE rather than in the page, because hiding the tabs only
// hides the tabs: ?view=all is a URL anybody can type, and the page is not a
// permission boundary. viewScope() below refuses to widen past what the
// viewer's matrix allows, so a forged query param lands back on their own
// rows instead of the company's.

import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/lib/db";
import { lastMatches, projects, users, zones } from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { teamUserIds } from "./scope";

export const LAST_MATCH_PAGE_SIZE = 25;

export type LastMatchView = "own" | "team" | "all";

export interface LastMatchFilters {
  view?: LastMatchView;
  type?: string;
  zoneId?: string;
  propertyType?: string;
  q?: string;
  page?: number;
}

/**
 * Which view scopes this viewer may actually ask for.
 *
 * `lastMatch: "all"` is the whole company — ผู้จัดการ and ซูเปอร์แอดมิน by
 * default, and anything the client grants it to in Settings. Everyone else
 * gets their own entries and nothing else: the ทีม view is withheld too,
 * because a team is other people's rows, which is exactly what is being
 * restricted.
 */
export function allowedViews(viewer: Viewer): LastMatchView[] {
  return viewer.perms.lastMatch === "all"
    ? ["own", "team", "all"]
    : ["own"];
}

/** The requested view, or the widest one this viewer is allowed instead. */
export function resolveView(
  viewer: Viewer,
  requested: string | undefined
): LastMatchView {
  const allowed = allowedViews(viewer);
  return allowed.includes(requested as LastMatchView)
    ? (requested as LastMatchView)
    : "own";
}

function viewScope(viewer: Viewer, view: LastMatchView): SQL | undefined {
  // Re-resolved rather than trusted. Callers pass a value that came off the
  // query string; this is the last place before the WHERE clause where that
  // can still be caught.
  switch (resolveView(viewer, view)) {
    case "all":
      return undefined;
    case "team":
      return inArray(lastMatches.salesId, teamUserIds(viewer.userId));
    case "own":
      return eq(lastMatches.salesId, viewer.userId);
  }
}

function lastMatchWhere(
  viewer: Viewer,
  f: LastMatchFilters
): SQL | undefined {
  const parts: (SQL | undefined)[] = [viewScope(viewer, f.view ?? "own")];
  if (f.q) {
    const like = `%${f.q}%`;
    parts.push(
      or(
        ilike(lastMatches.projectName, like),
        ilike(lastMatches.remark, like),
        ilike(lastMatches.buyerPersona, like)
      )
    );
  }
  if (f.type) parts.push(eq(lastMatches.type, f.type as never));
  if (f.zoneId) parts.push(eq(lastMatches.zoneId, f.zoneId));
  if (f.propertyType)
    parts.push(eq(lastMatches.propertyType, f.propertyType as never));
  // and() drops undefined and returns undefined for none
  return and(...parts);
}

export async function listLastMatches(viewer: Viewer, f: LastMatchFilters) {
  const db = getDb();
  const where = lastMatchWhere(viewer, f);
  const page = Math.max(1, f.page ?? 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: lastMatches.id,
        matchedAt: lastMatches.matchedAt,
        type: lastMatches.type,
        projectId: lastMatches.projectId,
        projectName: lastMatches.projectName,
        linkedProjectName: projects.nameEng,
        potential: lastMatches.potential,
        propertyType: lastMatches.propertyType,
        price: lastMatches.price,
        bed: lastMatches.bed,
        bath: lastMatches.bath,
        sqm: lastMatches.sqm,
        floor: lastMatches.floor,
        tower: lastMatches.tower,
        buyerPersona: lastMatches.buyerPersona,
        zoneName: zones.nameThai,
        zoneCode: zones.code,
        salesName: users.name,
      })
      .from(lastMatches)
      .leftJoin(users, eq(lastMatches.salesId, users.id))
      .leftJoin(zones, eq(lastMatches.zoneId, zones.id))
      .leftJoin(projects, eq(lastMatches.projectId, projects.id))
      .where(where)
      .orderBy(
        sql`${lastMatches.matchedAt} DESC NULLS LAST`,
        desc(lastMatches.createdAt)
      )
      .limit(LAST_MATCH_PAGE_SIZE)
      .offset((page - 1) * LAST_MATCH_PAGE_SIZE),
    db.select({ total: count() }).from(lastMatches).where(where),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / LAST_MATCH_PAGE_SIZE)),
  };
}

export type LastMatchRow = Awaited<
  ReturnType<typeof listLastMatches>
>["rows"][number];
