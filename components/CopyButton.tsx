"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/** Clipboard copy with a brief confirmation state (copy-for-post etc.). */
export function CopyButton({
  text,
  label = "คัดลอก",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "คัดลอกแล้ว ✓" : label}
    </Button>
  );
}
