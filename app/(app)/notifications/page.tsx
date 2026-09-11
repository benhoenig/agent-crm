import Link from "next/link";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Pagination,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { listNotifications } from "@/lib/repo/notifications";
import { formatDateTime } from "@/lib/format";
import { pageHref, param, type Search } from "@/lib/search-params";
import { cn } from "@/lib/cn";
import { markAllRead, markRead } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const { rows, total, page, pageCount } = await listNotifications(
    viewer,
    Number(param(sp, "page")) || 1
  );

  const hasUnread = rows.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="การแจ้งเตือน"
        sub="อัปเดตที่เกี่ยวกับคุณ — วันลา งานที่ได้รับมอบหมาย และระบบ"
        action={
          hasUnread ? (
            <form action={markAllRead}>
              <Button type="submit" variant="secondary">
                อ่านทั้งหมดแล้ว
              </Button>
            </form>
          ) : undefined
        }
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="ยังไม่มีการแจ้งเตือน"
            hint="เมื่อมีคำขอวันลา งานที่มอบหมายให้คุณ หรืออัปเดตระบบ จะแสดงที่นี่"
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {rows.map((n) => {
                const unread = !n.readAt;
                const content = (
                  <>
                    <div
                      className={cn(
                        "text-sm",
                        unread ? "font-semibold" : "text-ink-2"
                      )}
                    >
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="pt-0.5 text-xs text-ink-3">{n.body}</div>
                    )}
                    <div className="pt-1 text-xs text-ink-3">
                      {formatDateTime(n.createdAt)}
                    </div>
                  </>
                );
                return (
                  <li key={n.id} className="px-5 py-3.5">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          unread ? "bg-accent" : "bg-transparent"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        {n.link ? (
                          <Link
                            href={n.link}
                            className="block transition-colors hover:text-accent-text"
                          >
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </div>
                      {unread && (
                        <form action={markRead.bind(null, n.id)}>
                          <button
                            type="submit"
                            className="rounded-ctl px-2 py-1 text-xs text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
                          >
                            อ่านแล้ว
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              hrefFor={pageHref("/notifications", sp)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
