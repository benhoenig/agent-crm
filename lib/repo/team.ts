// /team repository. The directory (names, positions, zones, work contacts)
// is visible to every signed-in role — sheet-era norm. HR PII (ID card,
// address, emergency contacts, agreement files) is stripped unless the viewer
// manages the team or is looking at themselves.

import { and, count, desc, eq, gte, isNotNull, lt, ne, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { deals, leads, listings, userRoles, userZones, users, zones } from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { hasRole } from "./options";
import { bkkToday } from "@/lib/format";
import { ACTIVE_LISTING_ROLES } from "@/lib/options/kinds";

/** userId → [{id, code, name}] for a set of users (one grouped query). */
async function zonesByUser() {
  const rows = await getDb()
    .select({
      userId: userZones.userId,
      zoneId: zones.id,
      code: zones.code,
      nameThai: zones.nameThai,
      nameEng: zones.nameEng,
    })
    .from(userZones)
    .innerJoin(zones, eq(userZones.zoneId, zones.id))
    .orderBy(zones.code);

  const map = new Map<
    string,
    { id: string; code: string; name: string }[]
  >();
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push({ id: r.zoneId, code: r.code, name: r.nameThai ?? r.nameEng });
    map.set(r.userId, list);
  }
  return map;
}

export async function listTeam() {
  const [members, zoneMap] = await Promise.all([
    getDb()
      .select({
        id: users.id,
        name: users.name,
        nickname: users.nickname,
        nameThai: users.nameThai,
        email: users.email,
        image: users.image,
        role: users.role,
        position: users.position,
        division: users.division,
        team: users.team,
        phone: users.phone,
        banned: users.banned,
        employmentStatus: users.employmentStatus,
      })
      .from(users)
      .orderBy(users.banned, users.role, users.name),
    zonesByUser(),
  ]);

  return members.map((m) => ({ ...m, zones: zoneMap.get(m.id) ?? [] }));
}

/** Whether the viewer may see HR PII fields on this member's profile. */
export function canSeeHrPII(viewer: Viewer, memberId: string): boolean {
  return viewer.perms.teamManage || viewer.userId === memberId;
}

export async function getTeamMember(viewer: Viewer, id: string) {
  const db = getDb();
  const [member] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!member) return null;

  const memberZones = await db
    .select({ id: zones.id, code: zones.code, nameThai: zones.nameThai, nameEng: zones.nameEng })
    .from(userZones)
    .innerJoin(zones, eq(userZones.zoneId, zones.id))
    .where(eq(userZones.userId, id))
    .orderBy(zones.code);

  const year = Number(bkkToday().slice(0, 4));
  const [[activeListings], [dealsYear]] = await Promise.all([
    db
      .select({ n: count() })
      .from(listings)
      .where(
        and(
          eq(listings.agentId, id),
          hasRole(listings.status, "listing_status", ACTIVE_LISTING_ROLES)
        )
      ),
    db
      .select({
        n: count(),
        commission: sql<string>`coalesce(sum(${deals.commission}), 0)`,
      })
      .from(deals)
      .where(
        and(
          eq(deals.salesId, id),
          gte(deals.closingDate, `${year}-01-01`),
          lt(deals.closingDate, `${year + 1}-01-01`)
        )
      ),
  ]);

  if (!canSeeHrPII(viewer, id)) {
    member.idCardNo = null;
    member.address = null;
    member.emergencyContacts = null;
    member.agreementFiles = null;
    member.remark = null;
  }

  return {
    member,
    zones: memberZones.map((z) => ({
      id: z.id,
      code: z.code,
      name: z.nameThai ?? z.nameEng,
    })),
    stats: {
      activeListings: activeListings.n,
      dealsThisYear: dealsYear.n,
      commissionThisYear: dealsYear.commission,
    },
  };
}

/** All zones for the assignment checklist (admin edit panel). */
/** Everyone who can be somebody's manager — the dropdown on /team/[id]/edit.

    Membership comes from `user_roles`, not `users.role`: Do and Stang are
    manager AND sales, and their PRIMARY role is not always the manager one,
    so the primary column would offer an empty list. Banned users are excluded
    — a departed manager is not somebody to report to. */
export async function getManagerOptions() {
  return getDb()
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(
      userRoles,
      and(eq(userRoles.userId, users.id), eq(userRoles.roleId, "manager"))
    )
    .where(eq(users.banned, false))
    .orderBy(users.name);
}

/** People who could report to `viewerId` — the ทีมของฉัน panel.

    NOT SIMPLY "everyone holding the sales role", which is what this was until
    Ben caught it: Do and Stang hold manager AND sales (they run the team and
    carry 300+ listings each), so a plain sales query put Do in his own claim
    list and offered him Stang, his peer. Two exclusions, for two different
    reasons:

      the viewer      Nobody manages themselves. The FK would happily store
                      manager_id = id, and every "who reports to me" read
                      would then count the manager as their own report.
      other managers  A manager is not somebody's report in this company.
                      Leaving them listed makes claiming a peer a mis-click
                      away, and the reporting line is manager → sales.

    Still TEAM-WIDE otherwise: a manager has to see who is already on somebody
    else's team before claiming them, or "claim" quietly becomes "take" with
    no way to notice. */
export async function getSalesRoster(viewerId: string) {
  const mgr = alias(users, "mgr");
  const mgrRole = alias(userRoles, "mgr_role");
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
      image: users.image,
      managerId: users.managerId,
      managerName: mgr.name,
    })
    .from(users)
    .innerJoin(
      userRoles,
      and(eq(userRoles.userId, users.id), eq(userRoles.roleId, "sales"))
    )
    .leftJoin(mgr, eq(mgr.id, users.managerId))
    .where(
      and(
        eq(users.banned, false),
        ne(users.id, viewerId),
        notExists(
          getDb()
            .select({ one: sql`1` })
            .from(mgrRole)
            .where(
              and(
                eq(mgrRole.userId, users.id),
                eq(mgrRole.roleId, "manager")
              )
            )
        )
      )
    )
    .orderBy(users.name);
}

export async function getAllZones() {
  return getDb()
    .select({ id: zones.id, code: zones.code, nameThai: zones.nameThai, nameEng: zones.nameEng })
    .from(zones)
    .orderBy(zones.code);
}

export interface AccountRow {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  image: string | null;
  role: string;
  /** EXTRA roles beyond the primary (0017). Empty for a single-role account. */
  extraRoles: string[];
  /** HR record — options kind "employment_status". A different question from
      `banned`: one is the payroll, the other is the login. They can disagree
      (and do), which is why the editor shows them together. */
  employmentStatus: string | null;
  banned: boolean;
  banReason: string | null;
  lineUserId: string | null;
  createdAt: Date;
  /** What suspending this account would strand. Counted, not guessed: the
      difference between an account that owns 424 listings and one that owns
      nothing is the whole decision, and the old table showed neither. */
  listings: number;
  leads: number;
  deals: number;
}

/** The settings account list. Deactivated accounts sort last.

    The ownership counts are GROUPED queries merged in JS, not correlated
    subqueries. `sql\`(select count(*) from ${listings} where
    ${listings.agentId} = ${users.id})\`` looks right and is not: drizzle
    renders those column references unqualified, so it emits `where "agent_id"
    = "id"` and Postgres binds the bare "id" to the INNER table. It compares
    listings.agent_id to listings.id, matches nothing, and reports 0 for
    everyone — silently. */
export async function listAccounts(): Promise<AccountRow[]> {
  const db = getDb();
  const [rows, grants, byListing, byLead, byDeal] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        nickname: users.nickname,
        email: users.email,
        image: users.image,
        role: users.role,
        employmentStatus: users.employmentStatus,
        banned: users.banned,
        banReason: users.banReason,
        lineUserId: users.lineUserId,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.banned, users.role, desc(users.createdAt)),
    db.select({ userId: userRoles.userId, roleId: userRoles.roleId }).from(userRoles),
    db
      .select({ key: listings.agentId, n: count() })
      .from(listings)
      .where(isNotNull(listings.agentId))
      .groupBy(listings.agentId),
    db
      .select({ key: leads.assignedTo, n: count() })
      .from(leads)
      .where(isNotNull(leads.assignedTo))
      .groupBy(leads.assignedTo),
    db
      .select({ key: deals.salesId, n: count() })
      .from(deals)
      .where(isNotNull(deals.salesId))
      .groupBy(deals.salesId),
  ]);

  const tally = (rs: { key: string | null; n: number }[]) => {
    const m = new Map<string, number>();
    for (const r of rs) if (r.key) m.set(r.key, Number(r.n));
    return m;
  };
  const L = tally(byListing), D = tally(byLead), E = tally(byDeal);

  // grant set minus the primary — what the editor offers as "extra"
  const extra = new Map<string, string[]>();
  for (const g of grants) {
    const list = extra.get(g.userId) ?? [];
    list.push(g.roleId);
    extra.set(g.userId, list);
  }

  return rows.map((r) => ({
    ...r,
    extraRoles: (extra.get(r.id) ?? []).filter((id) => id !== r.role),
    listings: L.get(r.id) ?? 0,
    leads: D.get(r.id) ?? 0,
    deals: E.get(r.id) ?? 0,
  }));
}

/** One user's display name — for "reviewed by" stamps and similar. */
export async function getUserName(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.name ?? null;
}
