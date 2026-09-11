"use client";

// The one avatar renderer — team directory, member profile, topbar chip and
// the settings account editor all used to inline their own <img>.
//
// It is a client component for one reason: falling back when the image FAILS,
// not only when it is absent. `users.image` can point at an R2 key that is no
// longer in the bucket (the seed imported one such row), and a broken <img>
// renders as an empty circle — worse than the initial it replaced, and
// indistinguishable from a styling bug.
//
// Both checks are needed. `onError` catches a load that fails after mount; the
// ref check catches one that already failed BEFORE React hydrated, which fires
// no event at all and is the common case for server-rendered markup.

import * as React from "react";
import { cn } from "@/lib/cn";

export function Avatar({
  image,
  name,
  /** Tailwind size utility — also carries the text size for the initial. */
  size = "size-9 text-sm",
  className,
}: {
  image: string | null | undefined;
  /** Whatever the surface calls this person — nickname preferred. */
  name: string;
  size?: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [image]);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-bold text-accent-text",
        size,
        className
      )}
    >
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="size-full object-cover"
          ref={(el) => {
            if (el?.complete && el.naturalWidth === 0) setFailed(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        (name || "?").charAt(0).toUpperCase()
      )}
    </div>
  );
}
