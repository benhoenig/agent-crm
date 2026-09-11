"use server";

// Leave mutations. Requests are personal (userId = viewer); decisions require
// perms.leaveApprove and never on your own request. Notifications fan out
// AFTER the write — a notify failure logs but never fails the mutation.

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leaveAllowances, leaves, leaveType } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { dateStr, enumStr, int, numStr, str } from "@/lib/forms";
import { formatDate } from "@/lib/format";
import { notifyRoles, notifyUsers } from "@/lib/notify";
import { LEAVE_TYPE_LABEL } from "@/lib/labels";

export async function requestLeave(fd: FormData) {
  const viewer = await getViewer();

  const type = enumStr(fd, "type", leaveType.enumValues);
  const startDate = dateStr(fd, "startDate");
  const endDate = dateStr(fd, "endDate");
  if (!type || !startDate || !endDate) throw new Error("กรอกประเภทและวันที่ให้ครบ");
  if (endDate < startDate) throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");

  await getDb().insert(leaves).values({
    userId: viewer.userId,
    type,
    startDate,
    endDate,
    remark: str(fd, "remark"),
  });

  await notifyRoles(
    ["superadmin", "manager"],
    {
      type: "leave_request",
      title: `${viewer.name} ขอ${LEAVE_TYPE_LABEL[type] ?? "ลา"}`,
      body: `${formatDate(startDate)} – ${formatDate(endDate)}`,
      link: "/leave",
    },
    viewer.userId
  );

  revalidatePath("/leave");
}

export async function cancelLeave(id: string) {
  const viewer = await getViewer();
  await getDb()
    .update(leaves)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(leaves.id, id),
        eq(leaves.userId, viewer.userId),
        eq(leaves.status, "pending")
      )
    );
  revalidatePath("/leave");
}

async function decideLeave(id: string, status: "approved" | "rejected") {
  const viewer = await getViewer();
  if (!viewer.perms.leaveApprove) return;

  // Own requests need another approver — no self-approval. The status guard
  // in the UPDATE's WHERE makes a double-submit a no-op.
  const [updated] = await getDb()
    .update(leaves)
    .set({ status, approvedBy: viewer.userId })
    .where(
      and(
        eq(leaves.id, id),
        eq(leaves.status, "pending"),
        ne(leaves.userId, viewer.userId)
      )
    )
    .returning({
      userId: leaves.userId,
      type: leaves.type,
      startDate: leaves.startDate,
      endDate: leaves.endDate,
    });

  if (!updated) {
    revalidatePath("/leave");
    return;
  }

  await notifyUsers([updated.userId], {
    type: "leave_decision",
    title:
      status === "approved"
        ? `อนุมัติ${LEAVE_TYPE_LABEL[updated.type] ?? "การลา"}แล้ว`
        : `${LEAVE_TYPE_LABEL[updated.type] ?? "การลา"}ไม่ได้รับอนุมัติ`,
    body: `${formatDate(updated.startDate)} – ${formatDate(updated.endDate)} · โดย ${viewer.name}`,
    link: "/leave",
  });

  revalidatePath("/leave");
}

export async function approveLeave(id: string) {
  await decideLeave(id, "approved");
}

export async function rejectLeave(id: string) {
  await decideLeave(id, "rejected");
}

/** Per-user yearly allowance — admin, from the team detail page. */
export async function setLeaveAllowance(userId: string, fd: FormData) {
  const viewer = await getViewer();
  if (!viewer.perms.teamManage) return;

  const year = int(fd, "year");
  if (!year) return;

  const values = {
    sickDays: numStr(fd, "sickDays"),
    personalDays: numStr(fd, "personalDays"),
    vacationDays: numStr(fd, "vacationDays"),
  };

  const [existing] = await getDb()
    .select({ id: leaveAllowances.id })
    .from(leaveAllowances)
    .where(
      and(eq(leaveAllowances.userId, userId), eq(leaveAllowances.year, year))
    )
    .limit(1);

  if (existing) {
    await getDb()
      .update(leaveAllowances)
      .set(values)
      .where(eq(leaveAllowances.id, existing.id));
  } else {
    await getDb().insert(leaveAllowances).values({ userId, year, ...values });
  }

  revalidatePath(`/team/${userId}`);
  revalidatePath("/leave");
}
