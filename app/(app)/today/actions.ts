"use server";

// /today mutations. Plan-task mutations moved to app/(app)/plan/actions.ts
// with the full planner port (2026-08-23). Follow stamps live with their
// entities — /today imports markListingFollowed / markLeadFollowed.

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { actions, recap } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { dateStr, enumStr, int, numStr, str } from "@/lib/forms";
import { optionStr } from "@/lib/repo/options";
import { bkkToday } from "@/lib/format";

// Lead follow stamps: /today imports markLeadFollowed from the leads actions
// (single implementation), same as it imports markListingFollowed.

/** Quick action log. Retro fields (what/why/plan) belong to the goals flow. */
export async function logAction(fd: FormData) {
  const viewer = await getViewer();

  const category = await optionStr(fd, "category", "action_category");
  if (!category) throw new Error("Missing required field: category");

  await getDb().insert(actions).values({
    date: dateStr(fd, "date") ?? bkkToday(),
    agentId: viewer.userId,
    category,
    quantity: int(fd, "quantity"),
    hours: numStr(fd, "hours"),
    remark: str(fd, "remark"),
    recap: enumStr(fd, "recap", recap.enumValues),
  });

  revalidatePath("/today");
}
