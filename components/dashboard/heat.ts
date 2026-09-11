/* The shading ramp shared by the activity heatmap and the activity matrix.

   Ported from the Habihub Sales Dashboard's heatCell(), with one change: hers
   interpolates a fixed HSL green, which would be the one hardcoded colour on
   a page that is otherwise entirely design tokens and would not follow the
   light/dark switch. `color-mix` against --accent and --surface-3 gives the
   same ramp in whichever theme is live.

   THE FLOOR MATTERS. A cell with one action mixes at 12%, not at 1%: the
   difference between "nothing happened" and "something happened" is the most
   important read on the grid, and a 1% tint is invisible next to an empty
   cell. Zero keeps the plain surface, so it is unmistakable. */

import type { CSSProperties } from "react";

export function heatStyle(value: number, max: number): CSSProperties {
  if (!value) return { background: "var(--surface-3)", color: "var(--ink-3)" };
  const pct = Math.max(12, Math.min(100, Math.round((value / max) * 100)));
  return {
    background: `color-mix(in oklab, var(--accent) ${pct}%, var(--surface-3))`,
    // Lime is bright: past roughly half strength the cell needs the dark ink
    // that every accent-filled control uses, or the number sits on top of its
    // own background.
    color: pct > 55 ? "var(--accent-ink)" : "var(--ink)",
  };
}
