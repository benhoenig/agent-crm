"use server";

// Last Match mutations. This is an append-only market-intelligence log, like
// the sheet it replaces: v1 has NO edit and NO delete on purpose — a record
// of what closed in the market shouldn't be rewritable. Corrections happen by
// logging a new row; revisit only if real usage demands it.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { lastMatches, projects } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { dateStr, int, numStr, str } from "@/lib/forms";
import { optionStr } from "@/lib/repo/options";
import { bkkToday } from "@/lib/format";

export async function createLastMatch(fd: FormData) {
  const viewer = await getViewer();
  const db = getDb();

  const type = await optionStr(fd, "type", "last_match_type");
  if (!type) throw new Error("Missing required field: type");

  // Sales log under their own name; admin/manager may log for any agent.
  const salesId =
    viewer.perms.listings === "all"
      ? (str(fd, "salesId") ?? viewer.userId)
      : viewer.userId;

  const projectId = str(fd, "projectId");
  let projectName = str(fd, "projectName");

  // The text column is the sheet-era source of truth for display/search —
  // keep it always filled: copy the linked project's name when left blank.
  if (projectId && !projectName) {
    const [proj] = await db
      .select({ nameEng: projects.nameEng, nameThai: projects.nameThai })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    projectName = proj?.nameEng ?? proj?.nameThai ?? null;
  }

  await db.insert(lastMatches).values({
    salesId,
    type,
    matchedAt: dateStr(fd, "matchedAt") ?? bkkToday(),
    projectId,
    projectName,
    potential: await optionStr(fd, "potential", "listing_potential"),
    propertyType: await optionStr(fd, "propertyType", "property_type"),
    zoneId: str(fd, "zoneId"),
    price: numStr(fd, "price"),
    bed: int(fd, "bed"),
    bath: int(fd, "bath"),
    sqm: numStr(fd, "sqm"),
    floor: str(fd, "floor"),
    tower: str(fd, "tower"),
    direction: await optionStr(fd, "direction", "direction"),
    remark: str(fd, "remark"),
    buyerPersona: str(fd, "buyerPersona"),
  });

  revalidatePath("/last-match");
  redirect("/last-match");
}
