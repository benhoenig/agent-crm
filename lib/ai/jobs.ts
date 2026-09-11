"use server";

/* The AI parse queue — ported from the Klaichan/Mook CRM.
 *
 * A paste used to be a promise living inside a browser tab: you had to stay
 * in the form until it returned, and switching to LINE to copy the next
 * message could kill it (mobile Safari suspends backgrounded tabs). Here a
 * paste is a ROW. `enqueueParse` returns in milliseconds and the extraction
 * runs in `after()` (waitUntil on Workers), so the work finishes on the
 * server whether or not anyone is looking — and the draft is waiting in the
 * tray on any page, any device, after any refresh.
 *
 * Every action is scoped to the session user's id. Jobs are not deleted:
 * `consumedAt` hides them and `outcome` records whether the draft was saved.
 */

import { after } from "next/server";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { aiJobs } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import {
  parseLead,
  parseListing,
  type LeadParseDraft,
  type ListingParseDraft,
} from "./parse";

export type ParseKind = "listing" | "lead";
export type ParseStatus = "queued" | "running" | "done" | "error";

/** A job as the tray sees it. Dates are ISO strings — the client only ever
    formats them, and strings keep the action payload boring. */
export interface ParseJob {
  id: number;
  kind: ParseKind;
  status: ParseStatus;
  note: string | null;
  error: string | null;
  title: string;
  createdAt: string;
}

/* Both windows are evaluated by POSTGRES, not by JS — "now" then means one
   thing, the database's clock. */

/** A parse idle this long is not running: the function that owned its
    after() callback is gone. Generous next to a ~4s parse. */
const STUCK_AFTER = sql`interval '3 minutes'`;
/** How far back the tray looks — older unsaved drafts are stale enough that
    re-pasting beats resurrecting them. */
const TRAY_WINDOW = sql`interval '24 hours'`;

/** Starting a parse spends the OpenAI budget, so it is its own permission.
    Reading your own tray or binning a draft needs only a session. */
async function requireParse(): Promise<string> {
  const viewer = await getViewer();
  if (!viewer.perms.aiParse) redirect("/");
  return viewer.userId;
}

function titleFrom(rawText: string): string {
  const line =
    rawText.split("\n").map((l) => l.trim()).find(Boolean) ?? "ข้อความที่วาง";
  return line.length > 60 ? `${line.slice(0, 60)}…` : line;
}

type Row = typeof aiJobs.$inferSelect;
function toJob(r: Row): ParseJob {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    note: r.note,
    error: r.error,
    title: r.title ?? titleFrom(r.rawText),
    createdAt: r.createdAt.toISOString(),
  };
}

/** Do the extraction and write the result back. Runs detached in after(),
    so it must never throw — an escaped error would leave the row "running"
    until the stuck sweep catches it. */
async function runJob(id: number) {
  const db = getDb();
  const [row] = await db
    .update(aiJobs)
    .set({ status: "running", startedAt: new Date(), error: null })
    .where(eq(aiJobs.id, id))
    .returning();
  if (!row) return;

  try {
    const res =
      row.kind === "listing"
        ? await parseListing(row.rawText, row.userId)
        : await parseLead(row.rawText, row.userId);

    if (res.ok) {
      await db
        .update(aiJobs)
        .set({
          status: "done",
          draft: res.draft,
          note: res.note,
          error: null,
          title: res.title?.trim() || titleFrom(row.rawText),
          finishedAt: new Date(),
        })
        .where(eq(aiJobs.id, id));
    } else {
      await db
        .update(aiJobs)
        .set({ status: "error", error: res.error, finishedAt: new Date() })
        .where(eq(aiJobs.id, id));
    }
  } catch {
    await db
      .update(aiJobs)
      .set({
        status: "error",
        error: "แยกข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง",
        finishedAt: new Date(),
      })
      .where(eq(aiJobs.id, id))
      .catch(() => {
        /* the sweep will catch it */
      });
  }
}

/** Queue a paste. Returns as soon as the row exists — the caller gets a job
    to watch, not a parse to wait for. */
export async function enqueueParse(
  kind: ParseKind,
  rawText: string
): Promise<ParseJob> {
  const userId = await requireParse();
  const text = rawText.trim();
  if (!text) throw new Error("กรุณาวางข้อความก่อน");

  const [row] = await getDb()
    .insert(aiJobs)
    .values({ userId, kind, rawText: text, title: titleFrom(text) })
    .returning();

  after(() => runJob(row.id));
  return toJob(row);
}

/** Re-run a failed parse in place — one row per paste stays one row. */
export async function retryJob(id: number): Promise<void> {
  const userId = await requireParse(); // a retry spends budget like a paste
  const [row] = await getDb()
    .update(aiJobs)
    .set({
      status: "queued",
      error: null,
      draft: null,
      note: null,
      finishedAt: null,
      // restarts the stuck clock, or the sweep condemns the retry instantly
      startedAt: new Date(),
    })
    .where(
      and(eq(aiJobs.id, id), eq(aiJobs.userId, userId), isNull(aiJobs.consumedAt))
    )
    .returning();
  if (row) after(() => runJob(row.id));
}

/** Everything still waiting on the user: unconsumed, last 24h. Sweeps
    abandoned jobs to `error` first so a dead function shows as a retryable
    failure rather than a spinner that never stops. */
export async function listMyJobs(): Promise<ParseJob[]> {
  const viewer = await getViewer();
  const db = getDb();

  await db
    .update(aiJobs)
    .set({
      status: "error",
      error: "ระบบหยุดกลางคัน — กดลองใหม่ได้",
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(aiJobs.userId, viewer.userId),
        isNull(aiJobs.consumedAt),
        or(eq(aiJobs.status, "running"), eq(aiJobs.status, "queued")),
        sql`coalesce(${aiJobs.startedAt}, ${aiJobs.createdAt}) < now() - ${STUCK_AFTER}`
      )
    );

  const rows = await db
    .select()
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.userId, viewer.userId),
        isNull(aiJobs.consumedAt),
        sql`${aiJobs.createdAt} > now() - ${TRAY_WINDOW}`
      )
    )
    .orderBy(desc(aiJobs.createdAt));
  return rows.map(toJob);
}

/** One job's draft, for the ?draft= form prefill. Scoped to the owner. */
export async function getJobDraft(
  id: number
): Promise<
  | { kind: "listing"; note: string | null; draft: ListingParseDraft }
  | { kind: "lead"; note: string | null; draft: LeadParseDraft }
  | null
> {
  const viewer = await getViewer();
  const [row] = await getDb()
    .select()
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.id, id),
        eq(aiJobs.userId, viewer.userId),
        eq(aiJobs.status, "done")
      )
    )
    .limit(1);
  if (!row || !row.draft) return null;
  return row.kind === "listing"
    ? { kind: "listing", note: row.note, draft: row.draft as ListingParseDraft }
    : { kind: "lead", note: row.note, draft: row.draft as LeadParseDraft };
}

/** Take a job out of the tray. `saved` = the draft became a real record;
    `discarded` = it was binned. Stored, because the ratio over time is the
    only honest read on whether the extractor is good enough. */
export async function closeJob(
  id: number,
  outcome: "saved" | "discarded"
): Promise<void> {
  const viewer = await getViewer();
  await getDb()
    .update(aiJobs)
    .set({ consumedAt: new Date(), outcome })
    .where(and(eq(aiJobs.id, id), eq(aiJobs.userId, viewer.userId)));
}
