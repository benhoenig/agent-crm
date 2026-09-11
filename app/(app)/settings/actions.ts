"use server";

// /settings → กลุ่ม LINE mutations. Every action re-checks perms.settings
// (admin): the section layout gates the pages, but actions are their own
// entry points and must gate themselves.
//
// Account mutations moved to ./accounts-actions.ts when the บัญชีผู้ใช้ tab
// was rebuilt — they need p.teamManage, which is a different gate.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { lineGroups } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { reqStr, str } from "@/lib/forms";

async function requireSettings() {
  const viewer = await getViewer();
  if (!viewer.perms.settings) redirect("/");
  return viewer;
}

/* ── LINE groups ────────────────────────────────────────────────────── */

export async function addLineGroup(fd: FormData) {
  await requireSettings();

  await getDb().insert(lineGroups).values({
    lineGroupId: reqStr(fd, "lineGroupId"),
    name: str(fd, "name"),
  });

  revalidatePath("/settings/line");
}

export async function toggleLineGroup(id: string) {
  await requireSettings();
  const db = getDb();
  const [row] = await db
    .select({ active: lineGroups.active })
    .from(lineGroups)
    .where(eq(lineGroups.id, id))
    .limit(1);
  if (row) {
    await db
      .update(lineGroups)
      .set({ active: !row.active })
      .where(eq(lineGroups.id, id));
  }
  revalidatePath("/settings/line");
}

export async function deleteLineGroup(id: string) {
  await requireSettings();
  await getDb().delete(lineGroups).where(eq(lineGroups.id, id));
  revalidatePath("/settings/line");
}
