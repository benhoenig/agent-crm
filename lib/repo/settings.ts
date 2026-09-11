// /settings repository — master data reads. All /settings pages are gated by
// requirePermission(p => p.settings) in the section layout.

import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  lastMatches,
  leads,
  lineGroups,
  listings,
  projects,
  slaRules,
  userZones,
  users,
  zones,
} from "@/lib/db/schema";
import { allOptions, hasRole } from "@/lib/repo/options";
import { SLA_ENTITIES, type SlaEntity } from "@/lib/sla";
import { ACTIVE_LISTING_ROLES } from "@/lib/options/kinds";

/** A zone plus everything the editor needs to answer "can I touch this?" —
    what references it, and who covers it. The counts drive the delete gate
    (listings/projects/last-matches all FK to zones with NO ACTION, so a
    referenced zone genuinely cannot be deleted); the agents come from
    user_zones, which is what a zone *means* operationally. */
export interface ZoneDetail {
  id: string;
  code: string;
  nameEng: string;
  nameThai: string | null;
  location: string | null;
  listings: number;
  projects: number;
  lastMatches: number;
  agents: { id: string; name: string }[];
}

export async function listZones(): Promise<ZoneDetail[]> {
  const db = getDb();
  const [rows, coverage] = await Promise.all([
    db
      .select({
        id: zones.id,
        code: zones.code,
        nameEng: zones.nameEng,
        nameThai: zones.nameThai,
        location: zones.location,
      })
      .from(zones)
      .orderBy(asc(zones.code)),
    db
      .select({
        zoneId: userZones.zoneId,
        id: users.id,
        name: users.nickname,
        fullName: users.name,
      })
      .from(userZones)
      .innerJoin(users, eq(userZones.userId, users.id))
      .orderBy(asc(users.name)),
  ]);

  // Counts are GROUPED and merged here, never correlated subqueries: drizzle
  // renders `${listings.zoneId} = ${zones.id}` unqualified as
  // `"zone_id" = "id"`, and Postgres binds the bare "id" to the INNER table —
  // so it compared listings.zone_id to listings.id and reported 0 for every
  // zone. That silently disabled the delete gate (no zone ever looked used).
  const usage = await zoneUsageMap();

  const byZone = new Map<string, { id: string; name: string }[]>();
  for (const c of coverage) {
    const list = byZone.get(c.zoneId) ?? [];
    list.push({ id: c.id, name: c.name ?? c.fullName });
    byZone.set(c.zoneId, list);
  }

  return rows.map((z) => ({
    ...z,
    ...(usage.get(z.id) ?? { listings: 0, projects: 0, lastMatches: 0 }),
    agents: byZone.get(z.id) ?? [],
  }));
}

export interface ZoneUsage {
  listings: number;
  projects: number;
  lastMatches: number;
}

/** zoneId → what references it. Three grouped queries, merged — see the note
    in listZones() for why this is not a correlated subquery. Exported so the
    delete action gates on the SAME numbers the editor displays. */
export async function zoneUsageMap(): Promise<Map<string, ZoneUsage>> {
  const db = getDb();
  const [l, p, m] = await Promise.all([
    db
      .select({ key: listings.zoneId, n: count() })
      .from(listings)
      .where(isNotNull(listings.zoneId))
      .groupBy(listings.zoneId),
    db
      .select({ key: projects.zoneId, n: count() })
      .from(projects)
      .where(isNotNull(projects.zoneId))
      .groupBy(projects.zoneId),
    db
      .select({ key: lastMatches.zoneId, n: count() })
      .from(lastMatches)
      .where(isNotNull(lastMatches.zoneId))
      .groupBy(lastMatches.zoneId),
  ]);

  const out = new Map<string, ZoneUsage>();
  const put = (
    rs: { key: string | null; n: number }[],
    field: keyof ZoneUsage
  ) => {
    for (const r of rs) {
      if (!r.key) continue;
      const cur = out.get(r.key) ?? { listings: 0, projects: 0, lastMatches: 0 };
      cur[field] = Number(r.n);
      out.set(r.key, cur);
    }
  };
  put(l, "listings");
  put(p, "projects");
  put(m, "lastMatches");
  return out;
}

/* ── SLA rules ──────────────────────────────────────────────────────
   The editor is a matrix, not a list: one row per grade the clock could
   apply to, whether or not a rule exists. That distinction is the whole
   point — every overdue query INNER JOINs sla_rules, so a grade with no
   rule is never late, silently. A flat list of existing rows cannot show
   the gap; a row per grade can.                                        */

/** One cell of the matrix: a clock × a grade.
    - active — the grade is in the picklist
    - hidden — the grade is archived in Settings → รายการตัวเลือก but still
      has a rule or live rows, so hiding it here would hide real behaviour
    - orphan — a rule left over for a grade that no longer exists anywhere */
export interface SlaMatrixRow {
  entity: SlaEntity;
  potential: string;
  status: "active" | "hidden" | "orphan";
  tone: string | null;
  ruleId: string | null;
  /** null = no rule ⇒ nothing of this grade is ever flagged late. */
  maxDays: number | null;
  /** Rows this clock watches right now (scope only, rule ignored). */
  tracked: number;
  /** Of those, rows already past the limit — 0 when there is no rule. */
  overdue: number;
}

const BKK_TODAY = sql`(now() at time zone 'Asia/Bangkok')::date`;

/** Per-grade tracked/overdue counts, one query per clock. The scope and the
    reference dates are copied from lib/repo/today.ts on purpose: if the tab
    reported a different number than the queue it would be worse than no
    number at all. The only difference is that /settings is org-wide — no
    viewer scope, because the rule is org-wide. */
async function slaCounts(): Promise<Map<string, { tracked: number; overdue: number }>> {
  const db = getDb();
  const listingFollowRef = sql`coalesce(${listings.lastFollowedAt}, ${listings.listedAt}, (${listings.createdAt} at time zone 'Asia/Bangkok')::date)`;
  const leadFollowRef = sql`coalesce(${leads.lastFollowedAt}, (${leads.createdAt} at time zone 'Asia/Bangkok')::date)`;

  const [follow, post, lead] = await Promise.all([
    db
      .select({
        potential: listings.potential,
        tracked: count(),
        overdue: sql<number>`count(*) filter (where ${slaRules.maxDays} is not null and (${BKK_TODAY} - ${listingFollowRef}) > ${slaRules.maxDays})::int`,
      })
      .from(listings)
      .leftJoin(
        slaRules,
        and(
          eq(slaRules.entity, "listing_follow"),
          eq(slaRules.potential, listings.potential)
        )
      )
      .where(
        and(
          hasRole(listings.status, "listing_status", ACTIVE_LISTING_ROLES),
          isNotNull(listings.potential)
        )
      )
      .groupBy(listings.potential),
    db
      .select({
        potential: listings.potential,
        tracked: count(),
        overdue: sql<number>`count(*) filter (where ${slaRules.maxDays} is not null and (${BKK_TODAY} - ${listings.postedAt}) > ${slaRules.maxDays})::int`,
      })
      .from(listings)
      .leftJoin(
        slaRules,
        and(
          eq(slaRules.entity, "listing_post"),
          eq(slaRules.potential, listings.potential)
        )
      )
      .where(
        and(
          hasRole(listings.status, "listing_status", "posted"),
          isNotNull(listings.postedAt),
          isNotNull(listings.potential)
        )
      )
      .groupBy(listings.potential),
    db
      .select({
        potential: leads.potential,
        tracked: count(),
        overdue: sql<number>`count(*) filter (where ${slaRules.maxDays} is not null and (${BKK_TODAY} - ${leadFollowRef}) > ${slaRules.maxDays})::int`,
      })
      .from(leads)
      .leftJoin(
        slaRules,
        and(
          eq(slaRules.entity, "lead_follow"),
          eq(slaRules.potential, leads.potential)
        )
      )
      .where(
        and(
          hasRole(leads.leadStatus, "lead_status", "open"),
          isNotNull(leads.potential)
        )
      )
      .groupBy(leads.potential),
  ]);

  const map = new Map<string, { tracked: number; overdue: number }>();
  const add = (entity: SlaEntity, rows: typeof follow) => {
    for (const r of rows) {
      if (!r.potential) continue;
      map.set(`${entity}::${r.potential}`, {
        tracked: Number(r.tracked),
        overdue: Number(r.overdue),
      });
    }
  };
  add("listing_follow", follow);
  add("listing_post", post);
  add("lead_follow", lead);
  return map;
}

export async function listSlaMatrix(): Promise<SlaMatrixRow[]> {
  const [rules, opts, counts] = await Promise.all([
    getDb().select().from(slaRules),
    allOptions(),
    slaCounts(),
  ]);

  const out: SlaMatrixRow[] = [];

  for (const def of SLA_ENTITIES) {
    const byPotential = new Map(
      rules.filter((r) => r.entity === def.entity).map((r) => [r.potential, r])
    );
    const grades = opts.filter((o) => o.kind === def.kind);

    for (const g of grades) {
      const rule = byPotential.get(g.key);
      const c = counts.get(`${def.entity}::${g.key}`);
      // An archived grade only earns a row when it still has a rule or live
      // rows — otherwise it is noise the admin already chose to hide.
      if (g.archived && !rule && !c?.tracked) continue;
      out.push({
        entity: def.entity,
        potential: g.key,
        status: g.archived ? "hidden" : "active",
        tone: g.tone,
        ruleId: rule?.id ?? null,
        maxDays: rule?.maxDays ?? null,
        tracked: c?.tracked ?? 0,
        overdue: rule ? (c?.overdue ?? 0) : 0,
      });
      byPotential.delete(g.key);
    }

    // Whatever is left is a rule for a grade that no longer exists — dead
    // weight that also blocks renaming another grade onto that name.
    for (const [potential, rule] of byPotential) {
      out.push({
        entity: def.entity,
        potential,
        status: "orphan",
        tone: null,
        ruleId: rule.id,
        maxDays: rule.maxDays,
        tracked: 0,
        overdue: 0,
      });
    }
  }

  return out;
}

export async function listLineGroups() {
  return getDb().select().from(lineGroups).orderBy(asc(lineGroups.createdAt));
}
