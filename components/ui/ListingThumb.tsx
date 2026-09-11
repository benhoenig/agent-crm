"use client";

// Listing thumbnail for list rows (/listings, /inventory).
//
// Client component for the same reason Avatar is: listing_media rows can point
// at R2 keys that are no longer in the bucket — the import carried several —
// and a broken <img> renders as an empty box, which reads as a styling bug
// rather than "no photo". Both checks are needed: onError catches a load that
// fails after mount, the ref check catches one that already failed before React
// hydrated, which fires no event and is the common case for server-rendered
// markup.

import * as React from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

export function ListingThumb({
  /** r2Key from listing_media, or null when the listing has no still image. */
  thumbKey,
  className,
}: {
  thumbKey: string | null;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [thumbKey]);

  return (
    <div
      className={cn(
        "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-ctl border border-line bg-surface-3 text-ink-3",
        className
      )}
    >
      {thumbKey && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- R2-served, session-gated route; next/image can't optimize it
        <img
          src={`/media/${thumbKey}`}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          ref={(el) => {
            if (el?.complete && el.naturalWidth === 0) setFailed(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name="home" size={16} />
      )}
    </div>
  );
}
