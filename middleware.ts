import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic cookie check only — fast redirect for logged-out visitors.
// Real session validation happens server-side in requireSession().
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except login, auth API, the LINE webhook (signature-verified
    // machine traffic — a login redirect would break it), the cron route
    // (Vercel Cron, bearer-checked in the handler), the public build stamp, the PUBLIC token pages (share rooms + owner reports — the token
    // is the authorisation; a login redirect would lock the customer out),
    // tokened media, Next internals, and static assets.
    "/((?!login|api/auth|api/line|api/cron|api/version|share/|owner-report/|media/|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
