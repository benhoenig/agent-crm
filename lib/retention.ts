/* How long the access log is kept — the one place that number lives.
 *
 * ITS OWN FILE, WITH NO IMPORTS, so that anything can read it — the report
 * page, lib/repo/views.ts, the cron route — without pulling in the database
 * or `next/server`. Duplicating the number is how a retention policy quietly
 * becomes two retention policies that disagree.
 */

/** Ninety days: long enough to investigate a resignation after the fact,
    short enough that this never becomes a permanent record of where every
    colleague reads. */
export const VIEW_RETENTION_DAYS = 90;
