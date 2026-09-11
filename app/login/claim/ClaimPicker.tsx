"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

type Person = {
  id: string;
  name: string;
  nickname: string | null;
  position: string | null;
};

/**
 * First sign-in: tie this LINE account to a staff record.
 *
 * The list comes from the server behind the claim cookie set by the LINE
 * callback, so the staff roster is not readable by anyone who simply visits
 * this URL. Only people nobody has claimed yet are offered — once bound, an
 * account disappears from here and can only be moved by an admin
 * (ตั้งค่า → บัญชีผู้ใช้ → ยกเลิกการเชื่อม LINE).
 */
export function ClaimPicker() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [lineName, setLineName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/line/claim-options");
      if (cancelled) return;
      if (!res.ok) {
        setError(ERRORS.claim_expired);
        setPeople([]);
        return;
      }
      const data = (await res.json()) as { lineName: string; people: Person[] };
      setLineName(data.lineName);
      setPeople(data.people);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/auth/line/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selected }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(ERRORS[data.error ?? ""] ?? ERRORS.unknown);
      setSaving(false);
      return;
    }
    // Full navigation, not router.push — the session cookie was just set on
    // this response and every server component needs to see it.
    window.location.href = "/";
  }

  if (people === null) {
    return <p className="text-center text-sm text-ink-3">กำลังโหลด…</p>;
  }

  if (error && people.length === 0) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <p className="text-sm text-bad">{error}</p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => (window.location.href = "/login")}
        >
          กลับไปหน้าเข้าสู่ระบบ
        </Button>
      </Card>
    );
  }

  if (people.length === 0) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <p className="text-sm text-ink-2">
          ทุกบัญชีถูกเชื่อมกับ LINE อื่นไปแล้ว — ติดต่อแอดมินเพื่อยกเลิกการเชื่อม
        </p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => (window.location.href = "/login")}
        >
          กลับไปหน้าเข้าสู่ระบบ
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm text-ink-2">
          เข้าสู่ระบบด้วย LINE ชื่อ{" "}
          <span className="font-semibold text-ink">{lineName || "—"}</span>
        </p>
        <p className="pt-1 text-xs text-ink-3">
          เลือกชื่อของคุณเพื่อเชื่อมบัญชี — ทำครั้งเดียว ครั้งต่อไปกด
          &ldquo;เข้าสู่ระบบด้วย LINE&rdquo; ได้เลย
        </p>
      </Card>

      <Card className="max-h-[50vh] divide-y divide-line overflow-y-auto">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id)}
            className={`flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-surface-3 ${
              selected === p.id ? "bg-surface-3" : ""
            }`}
          >
            <span>
              <span className="block text-sm font-semibold text-ink">
                {p.nickname ? `${p.nickname} — ${p.name}` : p.name}
              </span>
              {p.position && (
                <span className="block text-xs text-ink-3">{p.position}</span>
              )}
            </span>
            {selected === p.id && (
              <span className="text-sm text-accent-text">✓</span>
            )}
          </button>
        ))}
      </Card>

      {error && <p className="text-sm text-bad">{error}</p>}

      <Button
        className="w-full"
        disabled={!selected || saving}
        onClick={confirm}
      >
        {saving ? "กำลังเชื่อมบัญชี…" : "ยืนยันและเข้าสู่ระบบ"}
      </Button>
    </div>
  );
}

const ERRORS: Record<string, string> = {
  claim_expired: "หมดเวลาแล้ว — กลับไปกด “เข้าสู่ระบบด้วย LINE” ใหม่อีกครั้ง",
  already_linked: "บัญชีนี้ถูกเชื่อมกับ LINE อื่นแล้ว — ติดต่อแอดมิน",
  line_in_use: "LINE ของคุณเชื่อมกับบัญชีอื่นอยู่แล้ว — ติดต่อแอดมิน",
  unknown_person: "ไม่พบบัญชีนี้ — ลองใหม่อีกครั้ง",
  session_failed: "สร้างเซสชันไม่สำเร็จ — ลองใหม่อีกครั้ง",
  unknown: "เชื่อมบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง",
};
