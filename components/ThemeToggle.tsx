"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

// Dark is the default; the choice persists in localStorage("hb-theme") and is
// applied pre-paint by the inline script in app/layout.tsx.
export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.dataset.theme === "light");
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    if (next) {
      document.documentElement.dataset.theme = "light";
      localStorage.setItem("hb-theme", "light");
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.setItem("hb-theme", "dark");
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={light ? "สลับเป็นโหมดมืด" : "สลับเป็นโหมดสว่าง"}
      className="flex size-9 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
    >
      <Icon name={light ? "moon" : "sun"} size={16} />
    </button>
  );
}
