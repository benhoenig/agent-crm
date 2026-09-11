/* Avatar constants + the pure helpers around them.

   Client-safe on purpose — no DB, no R2, no lib/media/r2 — because
   the settings editor is a client component and needs the accept list and the
   size limit to describe what it will take. The STORAGE half lives in
   lib/repo/avatar.ts. Same split as lib/options/kinds.ts vs lib/repo/options.ts.

   ── Why users.image carries a ?v= ──────────────────────────────────────
   The delivery route serves avatars with `cache-control: private,
   max-age=86400` because media keys are otherwise immutable. An avatar is
   the one key that ISN'T: replacing a jpg with another jpg reuses
   avatars/{id}.jpg, so without a changing URL the browser shows yesterday's
   photo for up to a day and the upload looks broken. The stamp changes the
   URL, not the key — /media/[...key] builds the key from the PATH, so the
   query string is ignored on the way through. */

export const AVATAR_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** What the file picker offers, and what the error message quotes. */
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
export const AVATAR_TYPES_TH = "JPG · PNG · WebP";

export type AvatarResult =
  | { ok: true; image: string | null }
  | { ok: false; error: string };

/** The R2 key inside a stored image URL, or null when it isn't one of ours
    (the seed imported some absolute http:// avatars). Strips the ?v= stamp —
    it is part of the URL, never part of the key. */
export function avatarKeyOf(image: string | null): string | null {
  if (!image || !image.startsWith("/media/")) return null;
  return image.slice("/media/".length).split("?")[0];
}
