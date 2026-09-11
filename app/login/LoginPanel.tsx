"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { LoginForm } from "./LoginForm";

/**
 * LINE first, password second — deliberately.
 *
 * Password sign-in runs scrypt, which does not fit the Workers Free CPU
 * budget (lib/auth/password.ts), so it is the break-glass path, not the daily
 * one. Folding it behind a toggle stops people reaching for the door that
 * sometimes sticks.
 */
export function LoginPanel({
  lineEnabled,
  error,
}: {
  lineEnabled: boolean;
  error?: string;
}) {
  const [showPassword, setShowPassword] = useState(!lineEnabled);
  const [lineError, setLineError] = useState<string | null>(
    error ? ERRORS[error] ?? ERRORS.unknown : null
  );
  const [loading, setLoading] = useState(false);

  async function signInWithLine() {
    setLineError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-in/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackURL: "/" }),
      });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) {
        setLineError(ERRORS.unknown);
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setLineError("เชื่อมต่อ LINE ไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {lineError && (
        <Card className="border-bad/40 bg-bad-soft p-3">
          <p className="text-sm text-bad">{lineError}</p>
        </Card>
      )}

      {lineEnabled && (
        <>
          <button
            type="button"
            onClick={signInWithLine}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-ctl bg-[#06C755] px-4 text-sm font-semibold text-white transition hover:bg-[#05b34c] disabled:opacity-60"
          >
            <LineGlyph />
            {loading ? "กำลังเปิด LINE…" : "เข้าสู่ระบบด้วย LINE"}
          </button>
          <p className="text-center text-xs text-ink-3">
            ใช้ LINE บัญชีเดียวกับที่ใช้ในกลุ่มงาน
          </p>
        </>
      )}

      {lineEnabled && !showPassword && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setShowPassword(true)}
        >
          เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน
        </Button>
      )}

      {showPassword && (
        <>
          {lineEnabled && (
            <div className="flex items-center gap-3 pt-1">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-3">หรือ</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          )}
          <LoginForm />
        </>
      )}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  line_cancelled: "ยกเลิกการเข้าสู่ระบบด้วย LINE",
  line_not_configured: "ยังไม่ได้ตั้งค่า LINE Login — ติดต่อแอดมิน",
  line_no_profile: "อ่านข้อมูลจาก LINE ไม่ได้ — ลองใหม่อีกครั้ง",
  line_no_account: "ไม่พบบัญชีพนักงานสำหรับ LINE นี้ — ติดต่อแอดมิน",
  line_session_failed: "สร้างเซสชันไม่สำเร็จ — ลองใหม่อีกครั้ง",
  banned: "บัญชีนี้พ้นสภาพแล้ว — ติดต่อแอดมิน",
  unknown: "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง",
};

function LineGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-current">
      <path d="M12 2C6.48 2 2 5.73 2 10.31c0 4.1 3.55 7.54 8.35 8.2.33.07.77.22.88.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1 .88.55s5.85-3.45 7.98-5.9C21.4 13.85 22 12.15 22 10.3 22 5.73 17.52 2 12 2ZM8.28 12.9H6.3a.26.26 0 0 1-.26-.26V8.72c0-.15.11-.27.26-.27h.5c.14 0 .26.12.26.27v3.14h1.22c.15 0 .26.12.26.27v.5c0 .15-.11.27-.26.27Zm1.55-.26c0 .14-.12.26-.27.26h-.5a.26.26 0 0 1-.26-.26V8.72c0-.15.12-.27.26-.27h.5c.15 0 .27.12.27.27v3.92Zm4.24 0c0 .14-.12.26-.27.26h-.5a.26.26 0 0 1-.21-.1l-1.8-2.43v2.27c0 .14-.12.26-.27.26h-.5a.26.26 0 0 1-.26-.26V8.72c0-.15.12-.27.26-.27h.53c.08 0 .16.04.21.1l1.77 2.4v-2.23c0-.15.12-.27.27-.27h.5c.15 0 .27.12.27.27v3.92Zm3.4-3.42c0 .15-.12.27-.27.27h-1.22v.47h1.22c.15 0 .27.12.27.26v.5c0 .15-.12.27-.27.27h-1.22v.47h1.22c.15 0 .27.12.27.26v.5c0 .15-.12.27-.27.27h-1.98a.26.26 0 0 1-.27-.26V8.72c0-.15.12-.27.27-.27h1.98c.15 0 .27.12.27.27v.5Z" />
    </svg>
  );
}
