import { ParseTray } from "@/components/ParseTray";
import { PositionNav } from "@/components/PositionNav";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { resolvePosition } from "@/lib/auth/position";
import { requireSession, viewerFromSession } from "@/lib/auth/session";
import { roleNames } from "@/lib/repo/roles";
import { getUnreadCount } from "@/lib/repo/notifications";

// Authenticated app shell. The login page lives outside this group;
// requireSession() is the real (DB-backed) gate behind the middleware's
// optimistic cookie check.
//
// THE SIDEBAR CARRIES THE UNION OF EVERY ROLE ITS OWNER HOLDS (Ben,
// 2026-08-29). It follows `perms`, and for ordinary staff those are now the
// merge of all their granted roles (lib/auth/session.ts resolve()) — so a
// manager who also sells gets both sets of menus and never switches seats to
// reach one. Admins are the exception: their position narrows everything, so
// their sidebar still shows exactly the seat they are borrowing.
//
// resolvePosition() is request-cached, so reading it here and inside
// viewerFromSession() is one resolution.
//
// IT ALSO CARRIES THE @modal SLOT — see the comment on {modal} below.
export default async function AppLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  const session = await requireSession();
  const viewer = await viewerFromSession(session);
  const { roles, perms } = viewer;
  const [unreadCount, roleLabel, position] = await Promise.all([
    getUnreadCount(viewer),
    roleNames().then((m: Record<string, string>) =>
      roles.map((r: string) => m[r] ?? r).join(" · ")
    ),
    resolvePosition(session.user.id, session.user.role),
  ]);
  return (
    <div className="flex h-dvh">
      <Sidebar perms={perms} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          unreadCount={unreadCount}
          user={{
            name: session.user.name,
            roleLabel,
            image: session.user.image ?? null,
          }}
        />
        {/* ADMINS ONLY, up here. For them the position narrows every page, so
            the control belongs above every page. For everyone else it now
            picks a dashboard and nothing more, and it renders on the dashboard
            instead — see app/(app)/page.tsx. Nothing to switch between is
            nothing to render either way: a plain sales agent should never
            learn this control exists. */}
        {position.narrowing && position.choices.length > 1 ? (
          <PositionNav
            active={position.active}
            choices={position.choices}
            narrowing
          />
        ) : null}
        <main className="min-w-0 flex-1 overflow-y-auto bg-bg p-6">
          {children}
        </main>
        {perms.aiParse ? <ParseTray /> : null}
      </div>
      {/* The @modal slot. Empty on every route except the ones intercepted
          into it (app/(app)/@modal), where it overlays the page above rather
          than replacing it — so + เพิ่มทรัพย์ and + เพิ่ม Lead open a form
          without taking the list away. Outside the scrolling <main> on
          purpose: the overlay is fixed to the viewport, not to the page. */}
      {modal}
    </div>
  );
}
