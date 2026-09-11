"use client";

/* Paste-to-form entry point on the create pages. Enqueue-and-walk-away:
   the button returns the moment the job row exists; the ParseTray follows
   the parse and hands the draft back via /…/new?draft=<id>. */

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { enqueueParse, type ParseKind } from "@/lib/ai/jobs";
import { AI_NOT_CONFIGURED } from "@/lib/ai/config";

const HINTS: Record<ParseKind, string[]> = {
  listing: [
    "ชื่อโครงการ · ประเภททรัพย์ · ขาย/เช่า",
    "นอน · น้ำ · ตร.ม. · ชั้น · ตึก · วิว · ทิศ",
    "ราคาขาย · ค่าเช่า/เดือน · หมายเหตุราคา",
    "ชื่อ · เบอร์ · LINE เจ้าของ (ถ้ามี)",
  ],
  lead: [
    "ชื่อลูกค้า · เบอร์โทร · LINE",
    "งบประมาณ · โครงการ/รหัสทรัพย์ที่สนใจ",
    "วางบทสนทนา LINE ทั้งบทได้ — AI สรุป Background / Requirement / Pain Point / Timeline ให้",
  ],
};

export function AiPasteBox({
  kind,
  configured,
}: {
  kind: ParseKind;
  /* Whether OPENAI_API_KEY is set, resolved on the server by aiConfigured().
     A boolean, never the key. When false the box still renders — hiding it
     would leave the user wondering where the feature went, and they would
     find out the parser is off only after pasting, waiting, and reading a
     failed job in the tray (Ben, 2026-08-30). */
  configured: boolean;
}) {
  const [text, setText] = useState("");
  const [queued, setQueued] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [pending, start] = useTransition();

  const submit = () => {
    const v = text.trim();
    if (!v || pending || !configured) return;
    start(async () => {
      try {
        await enqueueParse(kind, v);
        setText("");
        setQueued(true);
        window.dispatchEvent(new Event("ai-parse-queued"));
        setTimeout(() => setQueued(false), 4000);
      } catch {
        /* the tray shows job errors; enqueue errors are transient */
      }
    });
  };

  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface p-4">
      <div className="flex items-center justify-between gap-2 pb-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles size={14} className="text-accent-text" />
          วางข้อความให้ AI อ่าน
        </span>
        <button
          type="button"
          onClick={() => setShowHint((s) => !s)}
          className="text-xs text-ink-3 hover:text-ink"
        >
          ⓘ อ่านอะไรได้บ้าง
        </button>
      </div>
      {!configured && (
        <p className="mb-2 rounded-ctl bg-warn-soft px-3 py-2 text-xs text-warn">
          {AI_NOT_CONFIGURED} — ระหว่างนี้กรอกฟอร์มด้านล่างได้ตามปกติ
        </p>
      )}
      {showHint ? (
        <ul className="list-disc space-y-0.5 pb-2 pl-5 text-xs text-ink-3">
          {HINTS[kind].map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        disabled={!configured}
        placeholder={
          configured
            ? "วางข้อความจาก LINE / โพสต์ / โบรกเกอร์ ที่นี่ แล้วไปทำอย่างอื่นได้เลย — เสร็จแล้วจะเด้งที่มุมขวาล่าง"
            : "ยังใช้งานไม่ได้ — รอแอดมินตั้งค่า AI"
        }
        className="w-full resize-y rounded-ctl border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-good">{queued ? "✓ ส่งเข้าคิวแล้ว — ตามสถานะได้ที่มุมขวาล่าง" : ""}</span>
        <button
          type="button"
          onClick={submit}
          disabled={!configured || !text.trim() || pending}
          className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {pending ? "กำลังส่ง…" : "อ่านด้วย AI"}
        </button>
      </div>
    </div>
  );
}
