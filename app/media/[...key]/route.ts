// Gated delivery for the private R2 bucket (DATA_MODEL §6), via lib/media/r2.ts.
// Keys: listings/{listingId}/{kind}/{seq}.{ext} · deals/{dealId}/{type}/… ·
// projects/{projectId}/{seq}.{ext} · avatars/{userId}.{ext}
//
// The bucket is private and this route is the only way media leaves it, so
// entity-level visibility is enforced here with the same scope fragments the
// pages use: listing media follows listingScope, deal documents follow
// dealScope, avatars need only a session.
//
// TOKEN DOOR (public share rooms + owner reports): `?t=<token>` grants
// LISTING PHOTOS ONLY, and only when that live token actually covers the
// listing — the same check the page itself makes. Deal documents and
// avatars never open this way.

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getMedia } from "@/lib/media/r2";
import { deals, listings } from "@/lib/db/schema";
import { canBrowseDirectory, dealScope, listingScope } from "@/lib/repo/scope";
import { viewerFromSession, type Viewer } from "@/lib/auth/session";
import { ownerLinkCoversListing, shareCoversListing } from "@/lib/repo/public";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const segments = (await params).key.map(decodeURIComponent);
  if (segments.some((s) => s.includes("..") || s.includes("/"))) {
    return new Response("Bad key", { status: 400 });
  }
  const [root, entityId] = segments;

  // Public token door — listing photos only, share or owner-report token.
  const token = new URL(req.url).searchParams.get("t");
  if (token && root === "listings" && UUID.test(entityId)) {
    const covered =
      (await shareCoversListing(token, entityId)) ||
      (await ownerLinkCoversListing(token, entityId));
    if (covered) return serve(segments);
    // fall through to the session path — a stale token with a live session
    // should still see what the session may see
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  // Media visibility follows the viewer's WORKING POSITION, like every other
  // scoped read — viewerFromSession resolves it (lib/auth/position.ts).
  const viewer: Viewer = await viewerFromSession(session);

  if (root === "listings") {
    if (!UUID.test(entityId)) return new Response("Not found", { status: 404 });
    const [row] = await getDb()
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, entityId), listingScope(viewer)))
      .limit(1);
    if (!row) {
      // Outside the viewer's own scope. Inventory browsers (/inventory and the
      // read-only detail view) must still get the PHOTOS — a stock list you
      // cannot see is useless, and photos are not owner PII, which is gated
      // separately by ownerContacts. Without this the read-only detail page
      // renders a gallery of 404s. Everything else still 404s.
      if (!canBrowseDirectory(viewer)) {
        return new Response("Not found", { status: 404 });
      }
      const [exists] = await getDb()
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.id, entityId))
        .limit(1);
      if (!exists) return new Response("Not found", { status: 404 });
    }
  } else if (root === "deals") {
    if (!UUID.test(entityId)) return new Response("Not found", { status: 404 });
    const [row] = await getDb()
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.id, entityId), dealScope(viewer)))
      .limit(1);
    if (!row) return new Response("Not found", { status: 404 });
  } else if (root !== "avatars" && root !== "projects") {
    return new Response("Not found", { status: 404 });
  }
  /* `projects` needs only a session, like `avatars` — and unlike both scoped
     roots above. The survey itself is readable by everyone who can log in
     (lib/repo/projects.ts explains why that stayed true), so gating its photos
     harder than its text would protect nothing and only produce a record full
     of broken images. Reading is RECORDED rather than restricted; the log is
     written by the page, not here, because an <img> is not a read of the
     survey — counting every thumbnail would drown the real opens. */

  return serve(segments);
}

async function serve(segments: string[]): Promise<Response> {
  const object = await getMedia(segments.join("/"));
  if (!object) return new Response("Not found", { status: 404 });

  // Only the metadata that was stored with the object; a header set to
  // "undefined" is worse than no header.
  const h = new Headers();
  if (object.contentType) h.set("content-type", object.contentType);
  if (object.contentLanguage) h.set("content-language", object.contentLanguage);
  if (object.contentDisposition)
    h.set("content-disposition", object.contentDisposition);
  if (object.contentEncoding) h.set("content-encoding", object.contentEncoding);
  if (object.contentLength != null)
    h.set("content-length", String(object.contentLength));
  if (object.etag) h.set("etag", object.etag);
  // media keys are immutable (re-migration overwrites same keys) — cache in
  // the browser, but private: the bucket's whole point is scoped delivery
  h.set("cache-control", "private, max-age=86400");
  return new Response(object.body, { headers: h });
}
