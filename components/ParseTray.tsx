"use client";

/* The AI parse tray — a floating pill above the app shell mirroring the
   server's job rows. It deliberately owns no parse results of its own: the
   row is the truth, which is what makes a refresh, a phone lock or a switch
   to LINE mid-parse a non-event.

   Polls only while something is in flight (a parse takes ~4s; this costs a
   few indexed queries per paste), plus one fetch on mount and on focus. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X } from "lucide-react";
import {
  closeJob,
  listMyJobs,
  retryJob,
  type ParseJob,
} from "@/lib/ai/jobs";

const POLL_MS = 2500;

export function ParseTray() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ParseJob[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0); // guards a slow poll landing after a newer one

  const refresh = useCallback(() => {
    const mine = ++seq.current;
    listMyJobs()
      .then((rows) => {
        if (mine === seq.current) setJobs(rows);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    // the paste box broadcasts after enqueueing, so the tray wakes instantly
    const onQueued = () => {
      setOpen(true);
      refresh();
    };
    window.addEventListener("ai-parse-queued", onQueued);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("ai-parse-queued", onQueued);
    };
  }, [refresh]);

  const working = jobs.filter(
    (j) => j.status === "queued" || j.status === "running"
  ).length;

  useEffect(() => {
    if (!working) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [working, refresh]);

  if (!jobs.length) return null;

  const openDraft = (job: ParseJob) => {
    setOpen(false);
    router.push(
      job.kind === "listing"
        ? `/listings/new?draft=${job.id}`
        : `/leads/new?draft=${job.id}`
    );
  };

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {open ? (
        <div className="w-80 max-w-[calc(100vw-2rem)] rounded-card border border-line-strong bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold">AI อ่านข้อความ</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="ปิด"
              className="text-ink-3 hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {jobs.map((j) => (
              <li key={j.id} className="space-y-1.5 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  {j.status === "done" ? (
                    <span className="text-good">✓</span>
                  ) : j.status === "error" ? (
                    <span className="text-bad">✕</span>
                  ) : (
                    <Loader2 size={13} className="animate-spin text-accent-text" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {j.title}
                  </span>
                  <span className="shrink-0 text-[0.65rem] text-ink-3">
                    {j.kind === "listing" ? "ทรัพย์" : "Lead"}
                  </span>
                </div>
                {j.status === "error" && j.error ? (
                  <p className="text-xs text-bad">{j.error}</p>
                ) : null}
                {j.note && j.status === "done" ? (
                  <p className="text-xs text-ink-3">{j.note}</p>
                ) : null}
                <div className="flex gap-3 text-xs">
                  {j.status === "done" ? (
                    <>
                      <button
                        onClick={() => openDraft(j)}
                        className="font-semibold text-accent-text hover:underline"
                      >
                        เปิดร่างในฟอร์ม →
                      </button>
                      <button
                        onClick={() =>
                          closeJob(j.id, "discarded").then(refresh)
                        }
                        className="text-ink-3 hover:text-ink"
                      >
                        ทิ้ง
                      </button>
                    </>
                  ) : j.status === "error" ? (
                    <>
                      <button
                        onClick={() => retryJob(j.id).then(refresh)}
                        className="font-semibold text-accent-text hover:underline"
                      >
                        ลองใหม่
                      </button>
                      <button
                        onClick={() =>
                          closeJob(j.id, "discarded").then(refresh)
                        }
                        className="text-ink-3 hover:text-ink"
                      >
                        ทิ้ง
                      </button>
                    </>
                  ) : (
                    <span className="text-ink-3">กำลังอ่าน…</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold shadow-xl transition-colors hover:border-accent"
      >
        {working ? (
          <Loader2 size={15} className="animate-spin text-accent-text" />
        ) : (
          <Sparkles size={15} className="text-accent-text" />
        )}
        AI · {jobs.length}
      </button>
    </div>
  );
}
