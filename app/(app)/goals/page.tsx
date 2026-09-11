import Link from "next/link";
import {
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Pagination,
  Pill,
  Select,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { getAgentOptions, listGoals } from "@/lib/repo/goals";
import { goalStatus } from "@/lib/db/schema";
import { GOAL_STATUS_TONE, toneFor } from "@/lib/labels";
import { formatBaht, formatDate } from "@/lib/format";
import { pageHref, param, type Search } from "@/lib/search-params";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const seeAll = viewer.perms.goals === "all";

  const filters = {
    agentId: seeAll ? param(sp, "agent") || undefined : undefined,
    status: param(sp, "status") || undefined,
    page: Number(param(sp, "page")) || 1,
  };

  const [{ rows, total, page, pageCount }, agents] = await Promise.all([
    listGoals(viewer, filters),
    seeAll ? getAgentOptions() : Promise.resolve([]),
  ]);

  const hasFilters = Boolean(filters.agentId || filters.status);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="เป้าหมาย"
        sub="Targets board — ความคืบหน้าอิงคอมมิชชันจากดีลปิดในช่วงเวลาของเป้า"
        action={<LinkButton href="/goals/new">+ ตั้งเป้าหมาย</LinkButton>}
      />

      <Card className="p-4">
        <form className="flex flex-wrap gap-3">
          {seeAll && (
            <Select name="agent" defaultValue={filters.agentId ?? ""} className="w-56">
              <option value="">ทุกคน</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nickname ? `${a.name} (${a.nickname})` : a.name}
                </option>
              ))}
            </Select>
          )}
          <Select name="status" defaultValue={filters.status ?? ""} className="w-44">
            <option value="">ทุกสถานะ</option>
            {goalStatus.enumValues.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            กรอง
          </Button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title={hasFilters ? "ไม่พบเป้าหมายตามเงื่อนไข" : "ยังไม่มีเป้าหมาย"}
            hint={
              hasFilters
                ? "ลองปรับตัวกรอง"
                : "ตั้งเป้าแรกของคุณ — เป้าที่มีช่วงเวลาและจำนวนเงินจะเห็นความคืบหน้าอัตโนมัติ"
            }
            action={
              hasFilters ? undefined : (
                <LinkButton href="/goals/new">+ ตั้งเป้าหมาย</LinkButton>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((g) => {
              const target = g.targetAmount ? Number(g.targetAmount) : null;
              const actual = Number(g.actual);
              const pct =
                target && target > 0
                  ? Math.min(100, Math.round((actual / target) * 100))
                  : null;
              return (
                <Link key={g.id} href={`/goals/${g.id}/edit`} className="group">
                  <Card className="h-full px-5 py-4 transition-colors group-hover:border-line-strong">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold group-hover:text-accent-text">
                          {g.name}
                        </div>
                        <div className="pt-0.5 text-xs text-ink-3">
                          {seeAll && (g.agentNickname ?? g.agentName) ? (
                            <>{g.agentNickname ?? g.agentName} · </>
                          ) : null}
                          {g.goalType ?? "เป้าหมาย"}
                        </div>
                      </div>
                      <Pill tone={toneFor(GOAL_STATUS_TONE, g.status)}>{g.status}</Pill>
                    </div>

                    {target !== null && (
                      <div className="pt-4">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="num font-semibold">
                            {formatBaht(actual)}
                          </span>
                          <span className="num text-xs text-ink-3">
                            / {formatBaht(target)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              pct !== null && pct >= 100 ? "bg-good" : "bg-accent"
                            )}
                            style={{ width: `${pct ?? 0}%` }}
                          />
                        </div>
                        {pct !== null && (
                          <div className="num pt-1 text-right text-xs text-ink-3">
                            {pct}%
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-3 text-xs text-ink-3">
                      {g.startDate || g.targetDate
                        ? `${formatDate(g.startDate)} → ${formatDate(g.targetDate)}`
                        : "ไม่กำหนดช่วงเวลา"}
                    </div>
                    {g.remark && (
                      <div className="line-clamp-2 pt-1.5 text-xs text-ink-2">
                        {g.remark}
                      </div>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
          {pageCount > 1 && (
            <Card>
              <Pagination
                page={page}
                pageCount={pageCount}
                total={total}
                hrefFor={pageHref("/goals", sp)}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
