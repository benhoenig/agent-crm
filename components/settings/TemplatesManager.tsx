"use client";

// Post-template editor (Settings → เทมเพลตโพสต์) — one (type × tier) cell.
//
// The old editor was three textareas and a save button, and what it could not
// show is the only thing that matters here: what the template DOES to a real
// listing. lib/copy-render.ts prunes any segment whose placeholders are
// empty, by rules that are not guessable from looking at the text — " | ",
// " / ", the space between two adjacent placeholders, the bullet that belongs
// to the line rather than its first segment. Writing brand copy against those
// rules blind produces posts nobody proofreads.
//
// So the right half is a live preview against the client's OWN listings, and
// the default sample is the THINNEST one of this type — the listing that
// prunes hardest. If the copy survives that, it survives the book.
//
// The renderer is pure (no DB, no server-only imports), so the preview
// re-renders as you type, with no round trip. That also means the textareas
// are controlled by local draft state rather than defaultValue — which is why
// the "key by identity, never by value" rule that bit the other tabs cannot
// bite here: nothing remounts when the save lands.

import * as React from "react";
import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import { Button, Pill, Textarea } from "@/components/ui";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { formatNum } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PLACEHOLDER_LABELS, type TemplateSet } from "@/lib/copy-templates";
import { renderTemplate, valuesFor } from "@/lib/copy-render";
import type { TemplateCell, TemplateSample } from "@/lib/repo/copy-templates";
import {
  adoptTemplate,
  resetTemplate,
  setTemplateField,
  type TemplateField,
} from "@/app/(app)/settings/templates/actions";

const FIELDS: { key: TemplateField; label: string; hint: string; rows: number }[] =
  [
    {
      key: "headline",
      label: "หัวข้อโพสต์",
      hint: "บรรทัดแรก / ชื่อประกาศบนเว็บ",
      rows: 2,
    },
    {
      key: "normal",
      label: "เนื้อหา Facebook / LINE",
      hint: "ใส่อีโมจิได้",
      rows: 16,
    },
    {
      key: "dd",
      label: "เนื้อหาเว็บอสังหาฯ (DD / LV / PH)",
      hint: "ไม่ใส่อีโมจิ",
      rows: 16,
    },
  ];

const PICK_LABEL: Record<TemplateSample["pick"], string> = {
  thin: "ทรัพย์ข้อมูลน้อยสุด",
  rich: "ทรัพย์ข้อมูลครบสุด",
};

export function TemplatesManager({
  cell,
  samples,
}: {
  cell: TemplateCell;
  samples: TemplateSample[];
}) {
  const [draft, setDraft] = React.useState<TemplateSet>(cell.template);
  const [origin, setOrigin] = React.useState(cell.origin);
  /** Last text known to be on the server. The blur handler compares against
      this rather than against the `cell` prop: revalidatePath re-renders the
      page asynchronously, so `cell` is briefly stale right after a save and a
      focus-blur with no typing would post the same text again. */
  const committed = React.useRef<TemplateSet>(cell.template);
  const [savedField, setSavedField] = React.useState<TemplateField | null>(null);
  const [error, setError] = React.useState<{
    field: TemplateField | null;
    msg: string;
  } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // The thinnest listing is the honest default: it is where pruning shows.
  const [sampleId, setSampleId] = React.useState(
    () => samples[samples.length - 1]?.id ?? ""
  );
  const sample = samples.find((s) => s.id === sampleId) ?? samples[0] ?? null;

  const boxes = React.useRef<Partial<Record<TemplateField, HTMLTextAreaElement>>>(
    {}
  );
  // Null until a box has been focused. A chip inserts at the CURSOR, and an
  // unfocused textarea reports cursor 0 — so defaulting this to a field drops
  // the placeholder at the very start of the body, which is never what the
  // click meant. The chips stay disabled until there is a real cursor.
  const [lastFocused, setLastFocused] = React.useState<TemplateField | null>(
    null
  );

  React.useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  function flashSaved(field: TemplateField) {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedField(field);
    savedTimer.current = setTimeout(() => setSavedField(null), 1600);
  }

  function commit(field: TemplateField, value: string) {
    if (value === committed.current[field]) return;
    setError(null);
    startTransition(async () => {
      const res = await setTemplateField(
        cell.listingType,
        cell.tier,
        field,
        value
      );
      if (res.ok) {
        committed.current = { ...committed.current, [field]: value };
        // the row exists from here on, whatever it was before
        setOrigin("edited");
        flashSaved(field);
      } else {
        setError({ field, msg: res.error });
      }
    });
  }

  function adopt() {
    setError(null);
    startTransition(async () => {
      const res = await adoptTemplate(cell.listingType, cell.tier);
      if (res.ok) setOrigin("edited");
      else setError({ field: null, msg: res.error });
    });
  }

  function reset() {
    startTransition(async () => {
      const res = await resetTemplate(cell.listingType, cell.tier);
      if (!res.ok) {
        setError({ field: null, msg: res.error });
        return;
      }
      // The boxes are controlled by `draft`, so the discarded copy would sit
      // there until a navigation. Take the text the action hands back.
      committed.current = res.template;
      setDraft(res.template);
      setOrigin(cell.fallbackOrigin);
      setError(null);
    });
  }

  /** Drop a placeholder at the cursor of whichever box was last focused. */
  function insert(name: string) {
    const field = lastFocused;
    if (!field) return;
    const el = boxes.current[field];
    if (!el) return;
    const token = `<${name}>`;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setDraft((d) => ({ ...d, [field]: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const values = sample ? valuesFor(sample) : null;

  /** Placeholders this draft asks for that the sample listing hasn't got —
      i.e. exactly what the preview below is dropping. */
  const dropped = React.useMemo(() => {
    if (!values) return [];
    const wanted = new Set<string>();
    for (const t of [draft.headline, draft.normal, draft.dd])
      for (const m of t.matchAll(/<([^>]+)>/g)) wanted.add(m[1]);
    return [...wanted].filter((n) => (values[n] ?? "").trim() === "");
  }, [draft, values]);

  return (
    <div className="space-y-4 px-5 pb-5">
      {origin === "borrowed" ? (
        <div className="flex items-start gap-2.5 rounded-ctl bg-warn-soft px-3.5 py-3 text-xs leading-relaxed text-warn">
          <AlertTriangle size={15} className="mt-px shrink-0" />
          <div className="space-y-2">
            <p>
              <b>“{cell.listingType}” ยังไม่มีเทมเพลตของตัวเอง</b> —{" "}
              {formatNum(cell.listings)} ทรัพย์ในเทียร์นี้กำลังโพสต์ด้วยสำนวนของ “
              {cell.fallbackFrom}” ทั้งหมด ถ้าแก้เทมเพลตของ “{cell.fallbackFrom}”
              เมื่อไหร่ ทรัพย์กลุ่มนี้จะเปลี่ยนตามไปด้วยโดยไม่รู้ตัว
            </p>
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              onClick={adopt}
              disabled={pending}
            >
              สร้างเทมเพลตของ “{cell.listingType}” แยกออกมา
            </Button>
          </div>
        </div>
      ) : null}

      {error && error.field === null ? (
        <p className="rounded-ctl bg-bad-soft px-3 py-2 text-xs text-bad">
          {error.msg}
        </p>
      ) : null}

      {/* placeholder palette — click drops one at the cursor */}
      <div className="rounded-ctl border border-line bg-surface-2 px-3.5 py-3">
        <p className="pb-2 text-xs text-ink-3">
          {lastFocused
            ? "คลิกเพื่อแทรกช่องข้อมูลตรงตำแหน่งเคอร์เซอร์"
            : "คลิกในช่องข้อความด้านล่างก่อน แล้วปุ่มพวกนี้จะแทรกให้ตรงตำแหน่งเคอร์เซอร์"}{" "}
          · ช่องที่ทรัพย์ไม่มีข้อมูล ระบบ<b>ตัดทิ้งทั้งท่อน</b>ให้เอง
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PLACEHOLDER_LABELS).map(([name, label]) => (
            <button
              key={name}
              type="button"
              disabled={!lastFocused}
              // mousedown, not click: click fires after the textarea has
              // already blurred, and blur is what commits an edit
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(name)}
              title={`<${name}>`}
              className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-2 transition-colors enabled:hover:border-accent enabled:hover:text-accent-text disabled:cursor-not-allowed disabled:opacity-40"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* ── editor ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-ink-2">
                  {f.label}
                  <span className="pl-1.5 text-ink-3">{f.hint}</span>
                </span>
                {savedField === f.key ? (
                  <span className="flex items-center gap-1 text-[11px] text-good">
                    <Check size={12} /> บันทึกแล้ว
                  </span>
                ) : null}
              </div>
              <Textarea
                ref={(el) => {
                  if (el) boxes.current[f.key] = el;
                }}
                rows={f.rows}
                value={draft[f.key]}
                spellCheck={false}
                aria-label={`${f.label} — ${cell.listingType}`}
                className={cn(
                  "font-mono text-xs leading-relaxed",
                  error?.field === f.key && "border-bad"
                )}
                onFocus={() => setLastFocused(f.key)}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                }
                onBlur={(e) => commit(f.key, e.currentTarget.value)}
              />
              {error?.field === f.key ? (
                <p className="pt-1 text-xs text-bad">{error.msg}</p>
              ) : null}
            </div>
          ))}
        </div>

        {/* ── preview ────────────────────────────────────────────── */}
        <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-2">
              ตัวอย่างโพสต์จริง
            </span>
            {samples.length > 1 ? (
              <div className="flex gap-1">
                {samples.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSampleId(s.id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                      s.id === sampleId
                        ? "bg-accent-soft font-semibold text-accent-text"
                        : "text-ink-3 hover:bg-surface-2 hover:text-ink"
                    )}
                  >
                    {PICK_LABEL[s.pick]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {!sample || !values ? (
            <p className="rounded-ctl border border-line bg-surface-2 px-3.5 py-4 text-xs text-ink-3">
              ยังไม่มีทรัพย์ประเภท “{cell.listingType}” ในระบบ —
              เลยยังดูตัวอย่างโพสต์จริงไม่ได้
            </p>
          ) : (
            <>
              <p className="text-[11px] text-ink-3">
                {sample.legacyCode ?? "—"} · {sample.projectEng ?? "ไม่มีชื่อโครงการ"} ·
                กรอกครบ <span className="num">{sample.filled}</span>/
                <span className="num">
                  {Object.keys(PLACEHOLDER_LABELS).length}
                </span>{" "}
                ช่อง
              </p>

              {dropped.length > 0 ? (
                <p className="rounded-ctl bg-warn-soft px-3 py-2 text-[11px] leading-relaxed text-warn">
                  ทรัพย์นี้ไม่มี:{" "}
                  {dropped.map((d) => PLACEHOLDER_LABELS[d] ?? d).join(" · ")} —
                  ท่อนที่ใช้ช่องพวกนี้หายไปจากตัวอย่างข้างล่าง
                </p>
              ) : null}

              {[
                { label: "Facebook / LINE", body: draft.normal },
                { label: "เว็บอสังหาฯ", body: draft.dd },
              ].map(({ label, body }) => {
                const headline = renderTemplate(draft.headline, values);
                const text = renderTemplate(body, values);
                return (
                  <div key={label} className="space-y-1.5">
                    <Pill tone="muted">{label}</Pill>
                    <div className="rounded-ctl border border-line bg-surface-2 p-3">
                      {headline ? (
                        <p className="text-sm font-semibold">{headline}</p>
                      ) : (
                        <p className="text-xs text-bad">
                          หัวข้อว่างเปล่า — ทรัพย์นี้ไม่มีข้อมูลช่องที่หัวข้อใช้เลย
                        </p>
                      )}
                      {text ? (
                        <pre className="pt-2 font-sans text-xs leading-relaxed whitespace-pre-wrap text-ink-2">
                          {text}
                        </pre>
                      ) : (
                        <p className="pt-2 text-xs text-bad">
                          เนื้อหาว่างเปล่า — โพสต์นี้จะไม่มีอะไรเลย
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {origin === "edited" ? (
        <div className="flex justify-end border-t border-line pt-3">
          <ConfirmDelete
            onConfirm={reset}
            actionLabel="คืนค่าเริ่มต้น"
            confirmLabel={`ทิ้งเทมเพลตของ “${cell.listingType}”?`}
            warning={
              cell.fallbackOrigin === "borrowed" ? (
                <>
                  ข้อความที่เขียนไว้จะหายถาวร และ{" "}
                  <b>{formatNum(cell.listings)} ทรัพย์</b> ในเทียร์นี้จะกลับไป
                  <b>ยืมสำนวนของ “{cell.fallbackFrom}”</b> —
                  ประเภทนี้ไม่มีสำนวนตั้งต้นของตัวเอง
                </>
              ) : (
                <>
                  ข้อความที่เขียนไว้จะหายถาวร และ{" "}
                  <b>{formatNum(cell.listings)} ทรัพย์</b> ในเทียร์นี้จะกลับไป
                  ใช้สำนวนตั้งต้นที่มากับระบบ
                </>
              )
            }
            trigger={
              <span className="flex items-center gap-1.5 rounded-ctl px-2.5 py-1.5 text-xs text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad">
                <RotateCcw size={13} /> คืนค่าเริ่มต้น
              </span>
            }
            triggerAriaLabel="คืนค่าเริ่มต้น"
          />
        </div>
      ) : null}
    </div>
  );
}
