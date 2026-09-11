import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { lineGroups, users } from "@/lib/db/schema";
import { reply, textMessage, verifySignature } from "@/lib/line/client";
import { personalPlanCard, thaiDateLabel } from "@/lib/line/flex";
import { getPlanCardData } from "@/lib/repo/plan-card";
import { bkkToday } from "@/lib/format";

// POST /api/line/webhook — the CRM's ONLY LINE feature (DATA_MODEL §7),
// ported from the Solo Gang dashboard. Replies (FREE, no push quota) to
// group chat commands:
//   /plan        → the sender's own today plan (needs them linked first)
//   /<name>plan  → that agent's plan by nickname / email prefix, e.g. /doplan
//   /link <name> → binds the SENDER's LINE userId to that agent
//   /groupid     → prints the group's id (setup helper for /settings/line)
//
// Group-only by design: 1:1 chats are ignored. The allowlist is the
// line_groups table — unregistered groups get silence (except /groupid, so a
// new group can be captured for setup). Reliability: once the signature is
// valid we ALWAYS return 200 — LINE retries non-200 and would double-fire
// events; forged calls get 401 so the bot can't be made to reply.

export const dynamic = "force-dynamic";

interface LineEvent {
  type?: string;
  replyToken?: string;
  source?: { type?: string; userId?: string; groupId?: string; roomId?: string };
  message?: { type?: string; text?: string };
}

const nameKey = (n: string | null | undefined) =>
  String(n ?? "").toLowerCase().replace(/\s+/g, "");
const emailHandle = (e: string | null | undefined) =>
  String(e ?? "").split("@")[0].toLowerCase();

type Member = {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  lineUserId: string | null;
};

// Handle resolution order: nickname ("do" → Do) → email local-part → full
// name (spaceless). Nicknames come from the HR sheet, so the sheet-era habit
// of calling people by nickname keeps working.
function resolveByHandle(members: Member[], handle: string): Member | null {
  const h = nameKey(handle);
  if (!h) return null;
  return (
    members.find((u) => u.nickname && nameKey(u.nickname) === h) ??
    members.find((u) => emailHandle(u.email) === h) ??
    members.find((u) => nameKey(u.name) === h) ??
    null
  );
}

async function activeMembers(): Promise<Member[]> {
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
      email: users.email,
      lineUserId: users.lineUserId,
    })
    .from(users)
    .where(eq(users.banned, false));
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    ({ events = [] } = JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  await Promise.all(
    events.map((event) =>
      handleEvent(event).catch((err) =>
        console.error("[line/webhook] event failed:", event?.type, err)
      )
    )
  );

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineEvent) {
  if (event.type !== "message" || event.message?.type !== "text") return;
  const src = event.source ?? {};
  const groupId = src.groupId ?? src.roomId;
  const replyToken = event.replyToken;
  if (!groupId || !replyToken) return; // group-only, and a reply needs a token

  const text = String(event.message.text ?? "").trim();
  const lower = text.toLowerCase();

  // /groupid works in ANY group so a new group can be captured for setup.
  if (/^\/(groupid|id)$/.test(lower)) {
    await reply(replyToken, [textMessage(`groupId ของกลุ่มนี้:\n${groupId}`)]);
    return;
  }

  // Match the command BEFORE touching the DB so normal chatter costs nothing.
  const linkMatch = text.match(/^\/link\s+(.+)$/i);
  const isSelfPlan = /^\/plan$/i.test(lower);
  const planMatch = lower.match(/^\/([a-z0-9_.-]+)plan$/);
  if (!linkMatch && !isSelfPlan && !planMatch) return;

  // Allowlist gate: silence in unregistered/disabled groups.
  const [group] = await getDb()
    .select({ id: lineGroups.id })
    .from(lineGroups)
    .where(and(eq(lineGroups.lineGroupId, groupId), eq(lineGroups.active, true)))
    .limit(1);
  if (!group) return;

  const members = await activeMembers();

  if (linkMatch) {
    await handleLink(linkMatch[1], src.userId, replyToken, members);
  } else if (isSelfPlan) {
    const me = src.userId
      ? members.find((u) => u.lineUserId && u.lineUserId === src.userId)
      : undefined;
    if (!me) {
      await reply(replyToken, [
        textMessage("ยังไม่ได้เชื่อมบัญชี — พิมพ์ /link ชื่อเล่นของคุณ เช่น /link do"),
      ]);
      return;
    }
    await replyPlanCard(me, replyToken);
  } else if (planMatch) {
    const target = resolveByHandle(members, planMatch[1]);
    if (!target) {
      await reply(replyToken, [
        textMessage(`ไม่พบ "${planMatch[1]}" — ลองใช้ชื่อเล่น เช่น /doplan`),
      ]);
      return;
    }
    await replyPlanCard(target, replyToken);
  }
}

async function handleLink(
  arg: string,
  senderId: string | undefined,
  replyToken: string,
  members: Member[]
) {
  if (!senderId) {
    await reply(replyToken, [
      textMessage("ระบุผู้ใช้ไม่ได้ — ลองส่งข้อความใหม่อีกครั้ง"),
    ]);
    return;
  }

  const target = resolveByHandle(members, arg);
  if (!target) {
    await reply(replyToken, [
      textMessage(`ไม่พบชื่อ "${arg.trim()}" — ลองใช้ชื่อเล่น เช่น /link do`),
    ]);
    return;
  }

  // Two guards keep links honest (and the unique index happy):
  // an account already bound to a DIFFERENT LINE user stays bound (admin can
  // clear it from the team page), and one LINE user can't hold two accounts.
  if (target.lineUserId && target.lineUserId !== senderId) {
    await reply(replyToken, [
      textMessage(
        `${target.nickname ?? target.name} ถูกเชื่อมกับ LINE อื่นอยู่แล้ว — ให้แอดมินกดยกเลิกการเชื่อมที่หน้าพนักงานก่อน`
      ),
    ]);
    return;
  }
  const holder = members.find(
    (u) => u.lineUserId === senderId && u.id !== target.id
  );
  if (holder) {
    await reply(replyToken, [
      textMessage(
        `LINE ของคุณเชื่อมกับ ${holder.nickname ?? holder.name} อยู่แล้ว — ให้แอดมินยกเลิกก่อนถ้าต้องการย้าย`
      ),
    ]);
    return;
  }

  await getDb()
    .update(users)
    .set({ lineUserId: senderId })
    .where(and(eq(users.id, target.id), ne(users.banned, true)));

  await reply(replyToken, [
    textMessage(
      `✅ เชื่อมบัญชีกับ ${target.nickname ?? target.name} แล้ว — พิมพ์ /plan เพื่อดูแผนวันนี้`
    ),
  ]);
}

async function replyPlanCard(member: Member, replyToken: string) {
  const data = await getPlanCardData(member.id);
  const card = personalPlanCard(
    { name: member.nickname ?? member.name, goalPct: data.goalPct },
    data.tasks,
    {
      dateLabel: thaiDateLabel(bkkToday()),
      appUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
      onLeave: data.onLeave,
    }
  );
  await reply(replyToken, [card]);
}
