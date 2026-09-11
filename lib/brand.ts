/* The product name, in one place.

   This codebase was cloned from the Habihub CRM for a new client whose brand
   name is not yet decided, so the name is a constant rather than a string
   scattered across a dozen screens. When the client's name is known, change
   it HERE and every wordmark, page title, LINE card and cookie follows.

   Client-safe on purpose — no imports — because the Sidebar and Topbar
   (client components) render the wordmark and the root layout (server) sets
   the <title>. */

/** The wordmark: sidebar, login screen, public share pages, LINE card. */
export const BRAND = "AGENT";

/** Browser tab title + metadata. */
export const APP_NAME = `${BRAND} CRM`;

/** Metadata description (Thai, like the rest of the UI). */
export const APP_DESCRIPTION = `ระบบ CRM ของ ${BRAND}`;

/** Prefix for cookies this app sets outside Better Auth's own. Lowercase and
    URL-safe — a cookie name with a space or a dot in the wrong place is a
    silent failure in some browsers. */
export const COOKIE_PREFIX = "agent-crm";
