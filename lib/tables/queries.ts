import "server-only";

/* Reading a person's saved column layout.

   ONE QUERY PER PAGE RENDER, returning every grid's prefs at once rather than
   one call per table: the row is tiny, a person has at most one per grid, and
   /listings would otherwise pay a round trip to learn that nothing was saved. */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tablePrefs } from "@/lib/db/schema";
import { isTableKey, type TablePrefsMap } from "./index";

/** Every table preference this user has set. Absent keys mean "never touched
    the manager", which `resolve` reads as the registry's own order. */
export async function getTablePrefs(userId: string): Promise<TablePrefsMap> {
  const rows = await getDb()
    .select({
      tableKey: tablePrefs.tableKey,
      columnOrder: tablePrefs.columnOrder,
      hidden: tablePrefs.hidden,
    })
    .from(tablePrefs)
    .where(eq(tablePrefs.userId, userId));

  const out: TablePrefsMap = {};
  for (const r of rows) {
    // A row for a grid this release no longer knows about is skipped rather
    // than deleted — the table may come back, and a reading preference is not
    // worth a destructive write.
    if (!isTableKey(r.tableKey)) continue;
    out[r.tableKey] = { order: r.columnOrder ?? [], hidden: r.hidden ?? [] };
  }
  return out;
}
