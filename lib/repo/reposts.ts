// Repost due-ness — the queue is ARITHMETIC, not state (ported from the
// Klaichan/Mook CRM). A (listing × channel) pair is due when its anchor is
// at least `repost_rules.days` old; anchor = last push, falling back to the
// posted date, falling back to creation. Ticking ดันแล้ว stamps
// last_pushed_at = today, which moves the anchor and the row disappears
// until due again — no checklist table to reset, nothing that can drift.
//
// THE CADENCE IS THE SWITCH: filling a (grade × channel) cell in Settings
// puts every listing already on that channel on schedule immediately.
// No rule row = that combination is never due. A listing enters the queue
// for a channel once its listing_channels row exists (= it was posted
// there); live listings only (status role posted).

import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  listingChannels,
  listings,
  portalPushes,
  projects,
  repostRules,
  users,
} from "@/lib/db/schema";
import { allOptions, hasRole } from "./options";

export interface DueRepost {
  listingId: string;
  listingName: string | null;
  legacyCode: string | null;
  projectName: string | null;
  potential: string | null;
  channel: string;
  url: string | null;
  lastPushedAt: string | null;
  days: number;
  dueDate: string;
}

/** Where the clock starts: a real push always wins; a never-pushed pair
    falls back to the listing's posted date, then its creation day. */
const anchor = sql`COALESCE(${listingChannels.lastPushedAt}, ${listings.postedAt}, (${listings.createdAt} AT TIME ZONE 'Asia/Bangkok')::date)`;

function dueQuery() {
  return getDb()
    .select({
      listingId: listings.id,
      listingName: listings.listingName,
      legacyCode: listings.legacyCode,
      projectName: projects.nameThai,
      potential: listings.potential,
      channel: listingChannels.channel,
      url: listingChannels.url,
      lastPushedAt: listingChannels.lastPushedAt,
      days: repostRules.days,
      dueDate: sql<string>`(${anchor} + ${repostRules.days})::text`,
    })
    .from(listingChannels)
    .innerJoin(listings, eq(listings.id, listingChannels.listingId))
    .innerJoin(
      repostRules,
      and(
        eq(repostRules.gradeKey, listings.potential),
        eq(repostRules.channelKey, listingChannels.channel)
      )
    )
    .leftJoin(projects, eq(projects.id, listings.projectId))
    .where(
      and(
        // live inventory only — a sold listing needs no more pushing
        hasRole(listings.status, "listing_status", "posted"),
        sql`${anchor} + ${repostRules.days} <= CURRENT_DATE`
      )
    );
}

/** Everything due today, most overdue first. */
export async function getDueReposts(): Promise<DueRepost[]> {
  return dueQuery().orderBy(
    asc(sql`${anchor} + ${repostRules.days}`),
    asc(listings.id)
  );
}

export interface PushPerson {
  name: string;
  thisMonth: number;
  lastMonth: number;
}

/** ดันแล้ว ticks per person, this month vs last — the KPI view of the
    reposting work, bucketed in Bangkok time. */
export async function getPushStats(): Promise<PushPerson[]> {
  const bkk = sql`(${portalPushes.at} AT TIME ZONE 'Asia/Bangkok')`;
  const monthStart = sql`date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok')`;
  const person = sql<string>`COALESCE(${users.name}, 'ไม่ระบุ')`;
  return getDb()
    .select({
      name: person,
      thisMonth: sql<number>`count(*) FILTER (WHERE ${bkk} >= ${monthStart})::int`,
      lastMonth: sql<number>`count(*) FILTER (WHERE ${bkk} < ${monthStart})::int`,
    })
    .from(portalPushes)
    .leftJoin(users, eq(users.id, portalPushes.by))
    .where(sql`${bkk} >= ${monthStart} - interval '1 month'`)
    .groupBy(person)
    .orderBy(sql`2 DESC`);
}

/* ── Settings → รอบดันประกาศ ────────────────────────────────────────────
   The editor is a matrix, not a list of the rows that happen to exist: a
   (grade × channel) pair with NO rule is never due — the query above INNER
   JOINs repost_rules — and that silence is exactly what an admin needs to
   see. It also carries the two numbers the cadence actually decides:
   how many live listings sit on that pair, and therefore how much daily
   pushing the number he types is asking for.

   Both counts are built from the same `anchor` and the same live-inventory
   predicate as dueQuery(), a few lines up. That is deliberate: a settings
   page that disagreed with the queue it configures is worse than a settings
   page with no numbers on it.                                            */

export interface RepostCellCounts {
  /** Live listings posted on this channel carrying this grade. */
  listings: number;
  /** Of those, already past due right now (0 when the pair has no rule). */
  due: number;
}

/** Counts per "grade|channel". */
export async function getRepostCounts(): Promise<Map<string, RepostCellCounts>> {
  const rows = await getDb()
    .select({
      grade: listings.potential,
      channel: listingChannels.channel,
      listings: count(),
      due: sql<number>`count(*) FILTER (WHERE ${repostRules.days} IS NOT NULL AND ${anchor} + ${repostRules.days} <= CURRENT_DATE)::int`,
    })
    .from(listingChannels)
    .innerJoin(listings, eq(listings.id, listingChannels.listingId))
    .leftJoin(
      repostRules,
      and(
        eq(repostRules.gradeKey, listings.potential),
        eq(repostRules.channelKey, listingChannels.channel)
      )
    )
    .where(
      and(
        hasRole(listings.status, "listing_status", "posted"),
        isNotNull(listings.potential)
      )
    )
    .groupBy(listings.potential, listingChannels.channel);

  const map = new Map<string, RepostCellCounts>();
  for (const r of rows) {
    if (!r.grade) continue;
    map.set(`${r.grade}|${r.channel}`, {
      listings: Number(r.listings),
      due: Number(r.due),
    });
  }
  return map;
}

export interface RepostCell {
  channel: string;
  /** Channel archived in Settings → รายการตัวเลือก but still carrying a rule
      or live listings — hiding it here would hide live behaviour. */
  channelHidden: boolean;
  grade: string;
  gradeHidden: boolean;
  tone: string | null;
  ruleId: number | null;
  /** null = no rule ⇒ this pair is never due, silently. */
  days: number | null;
  listings: number;
  due: number;
}

/** A rule whose grade or channel no longer exists: it can never match a
    listing, and it blocks renaming another option onto that name. */
export interface RepostOrphan {
  id: number;
  gradeKey: string;
  channelKey: string;
  days: number;
  missing: "grade" | "channel" | "both";
}

export interface RepostMatrix {
  /** Channel order = the picklist order; each channel's live listing total. */
  channels: { key: string; hidden: boolean; listings: number }[];
  /** Ordered channel-major, then grade order. */
  cells: RepostCell[];
  orphans: RepostOrphan[];
}

export async function getRepostMatrix(): Promise<RepostMatrix> {
  const [rules, opts, counts] = await Promise.all([
    getDb().select().from(repostRules),
    allOptions(),
    getRepostCounts(),
  ]);

  const byPair = new Map(
    rules.map((r) => [`${r.gradeKey}|${r.channelKey}`, r])
  );
  const grades = opts.filter((o) => o.kind === "listing_potential");
  const channels = opts.filter((o) => o.kind === "listing_channel");
  const gradeKeys = new Set(grades.map((g) => g.key));
  const channelKeys = new Set(channels.map((c) => c.key));

  const cells: RepostCell[] = [];
  const shownChannels: RepostMatrix["channels"] = [];

  for (const ch of channels) {
    const row: RepostCell[] = [];
    for (const g of grades) {
      const pair = `${g.key}|${ch.key}`;
      const rule = byPair.get(pair);
      const c = counts.get(pair);
      // An archived option only earns a line when it still has a rule or live
      // listings — otherwise it is noise the admin already chose to hide.
      if ((g.archived || ch.archived) && !rule && !c?.listings) continue;
      row.push({
        channel: ch.key,
        channelHidden: ch.archived,
        grade: g.key,
        gradeHidden: g.archived,
        tone: g.tone,
        ruleId: rule?.id ?? null,
        days: rule?.days ?? null,
        listings: c?.listings ?? 0,
        due: rule ? (c?.due ?? 0) : 0,
      });
      byPair.delete(pair);
    }
    if (ch.archived && row.length === 0) continue;
    shownChannels.push({
      key: ch.key,
      hidden: ch.archived,
      listings: row.reduce((n, c) => n + c.listings, 0),
    });
    cells.push(...row);
  }

  const orphans: RepostOrphan[] = [];
  for (const r of byPair.values()) {
    const missingGrade = !gradeKeys.has(r.gradeKey);
    const missingChannel = !channelKeys.has(r.channelKey);
    // A rule always earns a line above, so a pair pointing at two live
    // options cannot reach here — but never call one an orphan if it does.
    if (!missingGrade && !missingChannel) continue;
    orphans.push({
      id: r.id,
      gradeKey: r.gradeKey,
      channelKey: r.channelKey,
      days: r.days,
      missing: missingGrade && missingChannel ? "both" : missingGrade ? "grade" : "channel",
    });
  }

  return { channels: shownChannels, cells, orphans };
}
