// The access log for market intelligence — writes and the two reads.
//
// See lib/db/schema/activity.ts recordViews for what is recorded and why it is
// the only read-logging table in the app.
//
// WRITES NEVER BLOCK AND NEVER THROW. Every caller is a PAGE, so a failure
// here would take down the page it was watching — the log would become the
// thing that broke the feature it exists to protect. logView() swallows its
// own errors (same contract as lib/notify.ts) and callers run it inside
// after(), which maps to waitUntil on Workers: the row is written once the
// response is already on its way to the browser, so a view costs the reader
// nothing.
//
// LIST VIEWS COUNT ROWS, DETAIL VIEWS COUNT ONE. A Last Match page hands over
// 25 records at once and has no single id; a โครงการ detail hands over one, in
// full. Recording both as "records put in front of this person" is what lets
// one report add them up — and record COUNT, not page count, is the number
// that separates ordinary work from somebody emptying the drawer.

import { after } from "next/server";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projects, recordViews, users } from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";
import { VIEW_RETENTION_DAYS } from "@/lib/retention";

/** The surfaces worth logging. Deliberately short — see the schema header. */
export type ViewEntity = "project" | "last_match";

export const VIEW_ENTITY_LABEL: Record<ViewEntity, string> = {
  project: "โครงการ",
  last_match: "Last Match",
};

/** How long the log is kept — the number itself lives in lib/retention.ts so
    the scheduled Worker can read it without importing any of this. */
export { VIEW_RETENTION_DAYS } from "@/lib/retention";

/**
 * Record that `viewer` was shown `rows` records of `entity`.
 *
 * CALL IT INSIDE after(). It is safe to await directly, but awaiting on a page
 * adds a round trip to a read path for a row nobody is waiting for.
 */
export async function logView(
  viewer: Viewer,
  entity: ViewEntity,
  recordId: string | null,
  rows = 1
): Promise<void> {
  // A page that rendered nothing exposed nothing. Logging it would bury the
  // real reads under every empty filter somebody tried.
  if (rows <= 0) return;
  try {
    await getDb()
      .insert(recordViews)
      .values({ userId: viewer.userId, entity, recordId, rows });
  } catch (err) {
    console.error("[views] log failed:", err);
  }
}

/** The fire-and-forget form every page uses. */
export function trackView(
  viewer: Viewer,
  entity: ViewEntity,
  recordId: string | null,
  rows = 1
): void {
  after(() => logView(viewer, entity, recordId, rows));
}

/* ── the report ────────────────────────────────────────────────────────── */

export interface ViewDay {
  day: string;
  userId: string;
  userName: string | null;
  entity: string;
  /** Records put in front of them that day — list rows included. */
  records: number;
  /** How many DISTINCT records they opened. Null for list-only days, which
      carry no ids. This is the exfiltration signal: reading the same survey
      ten times is research, reading three hundred different ones is not. */
  distinctRecords: number;
  /** Page opens, as a sanity check against `records`. */
  opens: number;
}

/**
 * Per person, per day, per surface — newest first.
 *
 * AGGREGATED IN SQL rather than streamed to JS. A year of ten people reading
 * is six figures of rows; the report wants a few hundred lines, and grouping
 * in Postgres is the difference between a page and a download.
 */
export async function viewActivity(days = 30): Promise<ViewDay[]> {
  const rows = await getDb()
    .select({
      day: sql<string>`(${recordViews.createdAt} at time zone 'Asia/Bangkok')::date::text`,
      userId: recordViews.userId,
      userName: users.name,
      entity: recordViews.entity,
      records: sql<number>`sum(${recordViews.rows})::int`,
      distinctRecords: sql<number>`count(distinct ${recordViews.recordId})::int`,
      opens: sql<number>`count(*)::int`,
    })
    .from(recordViews)
    .leftJoin(users, eq(users.id, recordViews.userId))
    .where(
      gte(recordViews.createdAt, sql`now() - make_interval(days => ${days})`)
    )
    .groupBy(
      sql`(${recordViews.createdAt} at time zone 'Asia/Bangkok')::date`,
      recordViews.userId,
      users.name,
      recordViews.entity
    )
    .orderBy(
      sql`(${recordViews.createdAt} at time zone 'Asia/Bangkok')::date desc`,
      sql`sum(${recordViews.rows}) desc`
    );
  return rows;
}

export interface ViewerOfRecord {
  userId: string;
  userName: string | null;
  opens: number;
  lastAt: Date;
}

/** Who has opened one record, most recent first — the "ใครเปิดดูบ้าง" panel. */
export async function viewersOf(
  entity: ViewEntity,
  recordId: string,
  limit = 20
): Promise<ViewerOfRecord[]> {
  return getDb()
    .select({
      userId: recordViews.userId,
      userName: users.name,
      opens: sql<number>`count(*)::int`,
      lastAt: sql<Date>`max(${recordViews.createdAt})`,
    })
    .from(recordViews)
    .leftJoin(users, eq(users.id, recordViews.userId))
    .where(
      and(eq(recordViews.entity, entity), eq(recordViews.recordId, recordId))
    )
    .groupBy(recordViews.userId, users.name)
    .orderBy(sql`max(${recordViews.createdAt}) desc`)
    .limit(limit);
}

/**
 * The busiest surveys in the window — what the reading is actually AIMED at.
 *
 * A person's daily total says how much they read; this says whether the
 * company's attention is spread across the book or pointed at one competitor's
 * project, which is a different question and occasionally the more useful one.
 */
export async function mostViewedProjects(days = 30, limit = 10) {
  return getDb()
    .select({
      recordId: recordViews.recordId,
      name: sql<string>`coalesce(${projects.nameThai}, ${projects.nameEng})`,
      opens: sql<number>`count(*)::int`,
      readers: sql<number>`count(distinct ${recordViews.userId})::int`,
    })
    .from(recordViews)
    .leftJoin(projects, eq(projects.id, recordViews.recordId))
    .where(
      and(
        eq(recordViews.entity, "project"),
        isNotNull(recordViews.recordId),
        gte(recordViews.createdAt, sql`now() - make_interval(days => ${days})`)
      )
    )
    .groupBy(recordViews.recordId, projects.nameThai, projects.nameEng)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/**
 * Drop anything past the retention window.
 *
 * RUN BY A REAL SCHEDULER — Vercel Cron calls /api/cron/retention nightly
 * (vercel.json). It used to run from the report page inside after(), which
 * carried an honest but bad caveat: if nobody ever opened the report, nothing
 * was ever swept, and a retention promise that only holds when somebody
 * happens to look is not a retention promise. It is also the wrong shape for
 * THIS table in particular, which exists so people can be held to account for
 * what they read — the promise that it is deleted after ninety days is owed to
 * the people being logged, not to whoever opens the report.
 *
 * The page no longer calls this. One owner, like every other queue here.
 *
 * ERRORS PROPAGATE. The caller is the cron route, and a throw there is a 500
 * in the Vercel cron log — the one place a failed sweep should be visible.
 * A sweep that fails tonight runs again tomorrow; a sweep that fails silently
 * is a retention promise nobody knows is broken.
 *
 * Returns how many rows went, for the log line.
 */
export async function sweepOldViews(): Promise<number> {
  const gone = await getDb()
    .delete(recordViews)
    .where(
      sql`${recordViews.createdAt} < now() - make_interval(days => ${VIEW_RETENTION_DAYS})`
    )
    .returning({ id: recordViews.id });
  return gone.length;
}
