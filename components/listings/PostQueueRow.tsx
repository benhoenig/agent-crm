"use client";

/* One row of the รอโพสต์ queue, with the whole job folded inside it (Ben,
   2026-09-11: "maybe make it the same page so they won't have to switch back
   and forth").

   WHY THE WORK IS IN THE ROW AND NOT A LINK. Everything support needs already
   existed on the listing drawer — the copy generator, the URL boxes, the
   status control — but spread down a long record and reached by leaving this
   page. Posting one listing meant: open it, scroll to ช่องทางการตลาด, save
   each portal separately, scroll back up to the Manage card, change the
   status, then navigate back to find the next one. Ten listings is ten round
   trips. Folded into the row it is: read the copy, paste, one button.

   THE POST TEXT IS RENDERED ON THE SERVER and passed in. It is the same
   generator the drawer's CopyStudio uses, but the templates are fetched once
   for the whole page instead of once per listing — the copy itself is a pure
   function of the listing, so there is nothing to look up per row. */

import { useState } from "react";
import { ChevronRight, ImageOff, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button, Input, Pill } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { savePostQueueUrls } from "@/app/(app)/listing-updates/actions";
import { formatNum } from "@/lib/format";
import type { PostQueueChannel } from "@/lib/repo/post-queue";
import type { Tone } from "@/components/ui";

export interface RenderedCopy {
  label: string;
  headline: string;
  body: string;
}

export function PostQueueRow({
  id,
  title,
  code,
  projectName,
  spec,
  potential,
  potentialTone,
  agentName,
  waitingDays,
  mediaCount,
  channels,
  channelNames,
  copies,
  missing,
}: {
  id: string;
  title: string;
  code: string | null;
  projectName: string | null;
  spec: string;
  potential: string | null;
  potentialTone: Tone;
  agentName: string | null;
  /** Null when the listing was never logged entering this status. */
  waitingDays: number | null;
  mediaCount: number;
  channels: PostQueueChannel[];
  /** Every portal in the catalog, so a channel with no row still gets a box. */
  channelNames: string[];
  copies: RenderedCopy[];
  /** Template placeholders this listing has nothing to fill — the post will
      come out short, and support should know before they paste it. */
  missing: string[];
}) {
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(channelNames.map((n) => [n, urlFor(channels, n)]))
  );
  // Warn-but-allow (Ben's call): posting with no URL is legal — an FB Group
  // post has no stable link — but it drops the listing out of the ดันประกาศ
  // cycle for good, so it has to be a decision rather than a slip.
  const [confirming, setConfirming] = useState(false);

  const filled = channelNames.filter((n) => urls[n]?.trim());
  const already = channels.filter((c) => c.url?.trim()).length;

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <ChevronRight
          size={14}
          className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate text-sm font-medium">{title}</span>
            {code && <span className="num text-[0.7rem] text-ink-3">{code}</span>}
            {potential && (
              <Pill tone={potentialTone} className="shrink-0">
                {potential}
              </Pill>
            )}
          </div>
          <div className="truncate pt-0.5 text-[0.72rem] text-ink-3">
            {[projectName, spec, agentName ? `ผู้ดูแล ${agentName}` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>

        {/* The two facts that decide whether this row can be worked at all. */}
        <div className="flex shrink-0 items-center gap-3 text-[0.7rem]">
          {mediaCount === 0 ? (
            <span className="flex items-center gap-1 text-bad">
              <ImageOff size={12} /> ไม่มีรูป
            </span>
          ) : (
            <span className="text-ink-3">{formatNum(mediaCount)} รูป</span>
          )}
          {already > 0 && (
            <span className="text-ink-3">{formatNum(already)} URL</span>
          )}
          <span className={waitingDays !== null && waitingDays > 3 ? "font-semibold text-warn" : "text-ink-3"}>
            {waitingDays === null ? "—" : `รอ ${formatNum(waitingDays)} วัน`}
          </span>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line bg-surface-2/40 px-4 py-4">
          {mediaCount === 0 && (
            <p className="flex items-start gap-2 rounded-ctl bg-bad-soft px-3 py-2 text-xs text-bad">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              ทรัพย์นี้ยังไม่มีรูปในระบบ — แจ้ง
              {agentName ? ` ${agentName} ` : "ผู้ดูแล"}
              ให้อัปโหลดก่อนโพสต์
            </p>
          )}

          {missing.length > 0 && (
            <p className="rounded-ctl bg-warn-soft px-3 py-2 text-xs text-warn">
              ยังไม่ได้กรอก: {missing.join(" · ")} — โพสต์จะสั้นกว่าที่ควร
            </p>
          )}

          {/* The copy, ready to paste into each platform. */}
          <div className="grid gap-3 lg:grid-cols-2">
            {copies.map((c) => (
              <div key={c.label} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Pill tone="muted">{c.label}</Pill>
                  <CopyButton
                    text={`${c.headline}\n\n${c.body}`}
                    label="คัดลอกโพสต์"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto rounded-ctl border border-line bg-surface p-3">
                  <p className="text-sm font-semibold">{c.headline}</p>
                  <pre className="whitespace-pre-wrap pt-2 font-sans text-xs leading-relaxed text-ink-2">
                    {c.body}
                  </pre>
                </div>
              </div>
            ))}
          </div>

          <form action={savePostQueueUrls.bind(null, id)} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {channelNames.map((name) => (
                <label key={name} className="space-y-1">
                  <span className="text-[0.7rem] font-medium text-ink-2">
                    {name}
                  </span>
                  <Input
                    type="url"
                    inputMode="url"
                    name={`url:${name}`}
                    value={urls[name] ?? ""}
                    onChange={(e) => {
                      setUrls((u) => ({ ...u, [name]: e.target.value }));
                      setConfirming(false);
                    }}
                    placeholder="วาง URL ประกาศ"
                    className="py-1.5 text-xs"
                  />
                </label>
              ))}
            </div>

            {confirming && (
              <p className="rounded-ctl bg-warn-soft px-3 py-2 text-xs text-warn">
                ยังไม่ได้ใส่ URL เลย — ทรัพย์นี้จะไม่เข้ารอบ “ดันประกาศ”
                จนกว่าจะมี URL อย่างน้อยหนึ่งช่องทาง · กด “โพสต์แล้ว”
                อีกครั้งเพื่อยืนยัน
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/listings/${id}`}
                className="text-xs text-accent-text hover:underline"
              >
                เปิดหน้าทรัพย์ ↗
              </Link>
              <Button
                type="submit"
                name="intent"
                value="save"
                variant="secondary"
                className="ml-auto px-3 py-1.5 text-xs"
              >
                บันทึก URL
              </Button>
              <Button
                type="submit"
                name="intent"
                value="post"
                className="px-3 py-1.5 text-xs"
                onClick={(e) => {
                  if (filled.length === 0 && !confirming) {
                    e.preventDefault();
                    setConfirming(true);
                  }
                }}
              >
                ✓ โพสต์แล้ว
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function urlFor(channels: PostQueueChannel[], name: string): string {
  return channels.find((c) => c.channel === name)?.url ?? "";
}
