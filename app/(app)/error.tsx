"use client";

// Error boundary for every authenticated surface. Server actions validate with
// `throw new Error("<Thai message>")` (lib/forms reqStr, leave date ranges,
// password rules, unique-constraint violations); without this, Next renders its
// generic English crash page and the user loses what they typed.
//
// In production React strips the message from the client payload, so
// `error.message` is only shown when it survives — otherwise a generic Thai
// line stands in. Either way the user gets a way back instead of a dead end.

import { useEffect } from "react";
import { Button, Card, LinkButton } from "@/components/ui";

const GENERIC = "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง หรือกลับไปหน้าก่อนหน้า";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  // Next's default production message — not useful to a Thai-speaking user.
  const message =
    !error.message ||
    error.message.startsWith("An error occurred in the Server Components")
      ? GENERIC
      : error.message;

  return (
    <div className="mx-auto max-w-lg pt-16">
      <Card className="px-6 py-8 text-center">
        <div className="text-sm font-semibold text-bad">ไม่สำเร็จ</div>
        <p className="pt-2 text-sm text-ink-2">{message}</p>
        {error.digest && (
          <p className="num pt-2 text-xs text-ink-3">รหัสอ้างอิง: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3 pt-5">
          <Button onClick={reset} variant="secondary">
            ลองใหม่
          </Button>
          <LinkButton href="/">กลับหน้าแรก</LinkButton>
        </div>
      </Card>
    </div>
  );
}
