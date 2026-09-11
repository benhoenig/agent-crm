"use server";

/* Saving a person's column layout.

   NO PERMISSION GATE, and it is the same deliberate exception the planner
   makes (app/(app)/plan/actions.ts): which columns YOU see on a grid you are
   already allowed to open is not an authorisation question. The pages gate
   themselves; this only records a reading preference, scoped to the session's
   own user id, which is never taken from the request body.

   NO revalidatePath either. The manager is optimistic — a tick has to move the
   column immediately — so the client holds the truth for the rest of the
   session and this call is fire-and-forget. Re-rendering /listings because
   someone hid a column would be a full page round trip for a checkbox. */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tablePrefs } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { isTableKey, sanitize, type TablePrefs } from "./index";

/** Replace one grid's layout for the signed-in user.

    `knownKeys` and `lockedKey` come from the client's own registry, which
    sounds like trusting the caller and is not: they are only ever used to
    NARROW what gets stored (see `sanitize`), so the worst a forged pair can do
    is save a preference that `resolve` then discards on read. The registry in
    code stays the authority on both ends. */
export async function saveTablePrefs(
  tableKey: string,
  prefs: TablePrefs,
  knownKeys: string[],
  lockedKey?: string
): Promise<void> {
  const viewer = await getViewer();
  if (!isTableKey(tableKey)) throw new Error("ตารางไม่ถูกต้อง");

  const clean = sanitize(knownKeys, lockedKey, prefs);

  await getDb()
    .insert(tablePrefs)
    .values({
      userId: viewer.userId,
      tableKey,
      columnOrder: clean.order,
      hidden: clean.hidden,
    })
    .onConflictDoUpdate({
      target: [tablePrefs.userId, tablePrefs.tableKey],
      set: {
        columnOrder: clean.order,
        hidden: clean.hidden,
        updatedAt: new Date(),
      },
    });
}

/** Forget a grid's layout — the "คืนค่าเริ่มต้น" button. Deletes the row rather
    than storing an empty one, so "never set" and "reset to default" are the
    same state and neither needs its own branch on read. */
export async function resetTablePrefs(tableKey: string): Promise<void> {
  const viewer = await getViewer();
  if (!isTableKey(tableKey)) throw new Error("ตารางไม่ถูกต้อง");

  await getDb()
    .delete(tablePrefs)
    .where(
      and(
        eq(tablePrefs.userId, viewer.userId),
        eq(tablePrefs.tableKey, tableKey)
      )
    );
}
