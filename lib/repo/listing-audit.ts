// Field-level audit for listing edits, plus the portal-sync handoff.
//
// WHY THIS IS A MODULE AND NOT A HELPER IN listings/actions.ts, where it lived
// until 2026-09-11. The รอโพสต์ queue marks listings posted, and that write
// has to produce the same audit trail and the same handoff as the drawer and
// the edit form — three callers, one rule. The obvious move was to export the
// helper from listings/actions.ts, but that file is "use server": every export
// in it becomes an HTTP-callable server action, and this function takes a raw
// `written` record of column names and values. Exporting it would have handed
// any logged-in browser an arbitrary-column writer on any listing it named.
// A plain module has no such door.

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { listings, listingUpdates } from "@/lib/db/schema";
import { allOptions } from "@/lib/repo/options";
import type { Viewer } from "@/lib/auth/session";

/**
 * Audit-diff comparison. Postgres numerics round-trip as "9400000.00" while
 * the parsed form posts "9400000" — comparing raw strings wrote a phantom
 * audit row for every price field on every save, so numeric-looking pairs
 * compare as numbers.
 */
export function fieldChanged(prev: unknown, next: unknown): boolean {
  const p = prev ?? "";
  const n = next ?? "";
  if (p !== "" && n !== "") {
    const pNum = Number(p);
    const nNum = Number(n);
    if (Number.isFinite(pNum) && Number.isFinite(nNum)) return pNum !== nNum;
  }
  return String(p) !== String(n);
}

/**
 * Write one listing_updates row per genuinely changed column, and decide
 * whether a status change owes support a portal update.
 *
 * CALLERS MUST HAVE ALREADY SCOPE-CHECKED AND WRITTEN THE ROW. This records
 * what happened; it is not a permission boundary and never re-reads the
 * listing to see if the caller was allowed to.
 */
export async function auditListingEdit(
  id: string,
  current: typeof listings.$inferSelect,
  written: Record<string, unknown>,
  viewer: Viewer
): Promise<void> {
  const db = getDb();
  const audit = Object.entries(written)
    .filter(([key, next]) =>
      fieldChanged(current[key as keyof typeof current], next)
    )
    .map(([key, next]) => ({
      listingId: id,
      editedAt: new Date(),
      columnName: key,
      oldValue: String(current[key as keyof typeof current] ?? ""),
      newValue: String(next ?? ""),
      status: "applied" as "applied" | "pending",
      requestedBy: viewer.userId,
    }));

  // Portal-sync handoff — the sheet-era "✅" twin statuses, done properly.
  // The CRM row is already updated (market truth is what sales knows); a
  // status change that takes a live listing OFF the portals is logged
  // "pending" so it lands in listing support's /listing-updates queue, and
  // the listing wears a "รอ Support อัปเดตพอร์ทัล" badge until support marks
  // the portals updated (markPortalUpdated → "applied").
  //
  // The other direction — a listing becoming READY to go on the portals — is
  // deliberately NOT logged pending here. It is a queue of listings, not of
  // edits, and it is derived from the status itself in lib/repo/post-queue.ts
  // so it cannot drift or be resolved away by mistake.
  const statusRow = audit.find((a) => a.columnName === "status");
  if (statusRow) {
    const catalog = await allOptions();
    const roleOf = (key: unknown) =>
      catalog.find((o) => o.kind === "listing_status" && o.key === key)?.role ??
      null;
    const wentOffPortals =
      roleOf(current.status) === "posted" && roleOf(written.status) !== "posted";
    // An open handoff means the portals already lag the CRM — chain further
    // status changes onto it until support confirms the portals match.
    let hasOpenHandoff = false;
    if (!wentOffPortals) {
      const [open] = await db
        .select({ id: listingUpdates.id })
        .from(listingUpdates)
        .where(
          and(
            eq(listingUpdates.listingId, id),
            eq(listingUpdates.columnName, "status"),
            eq(listingUpdates.status, "pending")
          )
        )
        .limit(1);
      hasOpenHandoff = Boolean(open);
    }
    if (wentOffPortals || hasOpenHandoff) statusRow.status = "pending";
  }

  if (audit.length) await db.insert(listingUpdates).values(audit);
}
