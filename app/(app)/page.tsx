import {
  LinkButton,
  PageHeader,
  TabNav,
} from "@/components/ui";
import { getDashboardContext } from "@/lib/auth/session";
import { PositionNav } from "@/components/PositionNav";
import { getCommissionTrend } from "@/lib/repo/dashboard";
import { bkkToday, formatDate } from "@/lib/format";
import { param, withParam, type Search } from "@/lib/search-params";
import { DealsPanel } from "./DealsPanel";
import { TargetRevenueCard } from "@/components/dashboard/TargetRevenueCard";
import { RevenueTrendCard } from "@/components/dashboard/RevenueTrendCard";
import { StageActivityCard } from "@/components/dashboard/StageActivityCard";
import { IntakeQueueCard } from "@/components/dashboard/IntakeQueueCard";
import { LeadBalanceCard } from "@/components/dashboard/LeadBalanceCard";
import { PlanColumn } from "@/components/plan/PlanColumn";
import { ListingPostQueue } from "@/components/today/ListingPostQueue";
import { getPlan } from "@/lib/repo/plan";
import { getFollowUps, getTodayActions } from "@/lib/repo/today";
import { getPipelineData, FUNNEL_WINDOWS } from "@/lib/repo/funnel";
import { targetsFor } from "@/lib/repo/targets";
import { REVENUE_METRIC } from "@/lib/targets";
import { optionKeys, optionsFor } from "@/lib/repo/options";

// ── ภาพรวมทีม (manager / admin / support) ──────────────────────────────
import { MonthRangePicker } from "@/components/dashboard/MonthRangePicker";
import { TeamRevenueHero } from "@/components/dashboard/TeamRevenueHero";
import { TeamTrendCard } from "@/components/dashboard/TeamTrendCard";
import { RevenueLeaderboardCard } from "@/components/dashboard/RevenueLeaderboardCard";
import { TeamKpiCard } from "@/components/dashboard/TeamKpiCard";
import { ActivityHeatmapCard } from "@/components/dashboard/ActivityHeatmapCard";
import { ActivityMatrixCard } from "@/components/dashboard/ActivityMatrixCard";
import {
  getActivityHeatmap,
  getActivityMatrix,
  getRevenueLeaderboard,
  getRevenueTargets,
  getSalesTeam,
  getTeamKpi,
  getTeamRevenue,
  getTeamTrend,
} from "@/lib/repo/team-overview";
import {
  monthsBetween,
  parseMonthRange,
  rangeLabel,
} from "@/lib/month-range";
import {
  actionMetric,
  CORE_TEAM_METRICS,
  DEAL_METRICS,
  type TeamMetric,
} from "@/lib/team-metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  /* THE ONE PAGE THAT READS THE POSITION (Ben, 2026-08-29). Everywhere else a
     multi-role viewer gets the merge of every role they hold; here they get
     the seat they picked, alone. ภาพรวมทีม and ของฉัน are reports on
     different people, and handing ของฉัน a merged matrix would scope "my
     funnel" to the whole company. See lib/auth/session.ts. */
  const { viewer, position } = await getDashboardContext();

  // ดีลปิด was its own /deals page until 2026-08-25. The tab lives in the URL
  // so /deals can redirect into it and so a filtered deal list stays linkable.
  const canSeeDeals = viewer.perms.deals !== "none";
  const tab = canSeeDeals && param(sp, "tab") === "deals" ? "deals" : "overview";

  const tabs = [
    { href: withParam("/", sp, "tab", null), label: "ภาพรวม", active: tab === "overview" },
    ...(canSeeDeals
      ? [{ href: withParam("/", sp, "tab", "deals"), label: "ดีลปิด", active: tab === "deals" }]
      : []),
  ];

  const header = (
    <PageHeader
      title="ภาพรวม"
      sub={`ข้อมูล ณ ${formatDate(bkkToday())} — ในขอบเขตของคุณ`}
      action={
        <div className="flex items-center gap-2">
          <TabNav items={tabs} />
          {/* ภาพรวม carries no create action: it is a read surface, and
              /listings already owns "+ เพิ่มทรัพย์" (Ben, 2026-08-25). ดีลปิด
              keeps its button because that tab IS the deal list — the same
              reason /listings has one. */}
          {tab === "deals" && (
            <LinkButton href="/deals/new">+ บันทึกดีล</LinkButton>
          )}
        </div>
      }
    />
  );

  /* The seat picker, for staff who hold more than one. Admins already have it
     under the Topbar on every page (app/(app)/layout.tsx), so rendering it
     again here would be two copies of one control on one screen. */
  const seatPicker =
    !position.narrowing && position.choices.length > 1 ? (
      <PositionNav
        active={position.active}
        choices={position.choices}
        narrowing={false}
      />
    ) : null;

  // Only the active tab's queries run — ภาพรวม is five aggregates and ดีลปิด is
  // a paginated list; loading both on every render would double the cost of a
  // page that is the app's landing screen.
  if (tab === "deals") {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        {header}
        {seatPicker}
        <DealsPanel viewer={viewer} sp={sp} />
      </div>
    );
  }

  // Lead intake is a CAPABILITY, not a role: rendered wherever intakeAssign is
  // held, so an admin or a sales+admin gets it in their own layout instead of
  // us hardcoding a third page (Ben, 2026-08-25).
  //
  // WHICH IS ADMIN, AND ONLY ADMIN (Ben, 2026-08-28). Manager held
  // intakeAssign until then, which is why these two cards survived the
  // rebuild of this page into a pure team report — they were gated right and
  // the permission was wrong. A manager reads the team; admin runs the intake
  // desk. See lib/auth/roles.ts.
  const intake = viewer.perms.intakeAssign ? (
    <>
      <IntakeQueueCard viewer={viewer} />
      <LeadBalanceCard />
    </>
  ) : null;

  // ── sales dashboard ──────────────────────────────────────────────────
  // A different landing screen for เซลส์ (Ben, 2026-08-25), modelled on Mook
  // CRM: the business on the left, the day on the right, and NO stat-tile row.
  // Managers/admin/support keep the aggregate view below — they are looking at
  // the team, not at their own targets and their own plan.
  //
  // Gated on the SELECTED POSITION. Not a permission: none of them means
  // "this person's own numbers are the interesting ones" — that is a layout
  // choice, and it is the choice the strip above exists to make. Do and Stang
  // are manager AND sales, so their granted role set answers "both" and cannot
  // pick a screen; the seat they are sitting in can.
  if (viewer.role === "sales") {
    // The card's window is a per-browser preference (localStorage), so the
    // SERVER cannot know it — it renders the default and the card refetches
    // if the reader has chosen another. 90 days is the default because a
    // funnel needs long enough for a lead to travel it.
    const defaultWindow = FUNNEL_WINDOWS[1];
    const bkkNow = bkkToday();
    const monthKey = bkkNow.slice(0, 7);
    /* ALWAYS `month`, scaled to the window (Ben, 2026-08-29).

       This used to be periodForDays(90) → "quarter", which silently broke the
       moment target-setting moved to the manager: the editor on
       ผลงานตามกระบวนการขาย writes period='month', so a quarter-period read
       matched nothing and every target a manager set was invisible here. One
       period length is stored now, and the window scales it. */
    const [
      pipeline, trend, plan, taskTypeRows, followUps, targets,
      activities, actionCategories, monthRevenue,
    ] = await Promise.all([
      getPipelineData(viewer, defaultWindow),
      getCommissionTrend(viewer),
      getPlan(viewer.userId),
      optionsFor("task_type"),
      getFollowUps(viewer),
      targetsFor(viewer.userId, "month", defaultWindow / 30, monthKey),
      getTodayActions(viewer),
      optionKeys("action_category"),
      getTeamRevenue(viewer, { from: monthKey, to: monthKey }),
    ]);

    return (
      <div className="mx-auto max-w-6xl space-y-5">
        {header}
        {seatPicker}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* left 2/3 — the business */}
          <div className="flex flex-col gap-5 xl:col-span-2">
            {/* a selling admin/manager triages before they sell */}
            {intake}
            {/* `standing`, not `effective`: effective is scaled to the
                90-day funnel window above, and this card is one month. */}
            <TargetRevenueCard
              target={targets.standing[REVENUE_METRIC] ?? null}
              actual={monthRevenue.total}
              today={bkkNow}
            />
            <RevenueTrendCard rows={trend} />
            <StageActivityCard initial={pipeline} targets={targets} />
          </div>
          {/* right 1/3 — the day. PlanColumn owns one usePlanner across all
              of its cards, so it is mounted whole (see its own note).
              ติดตามวันนี้ and โพสต์เก่า sit inside it: work that is already
              due, which is exactly what "what do I do today" means here. */}
          <div className="flex flex-col gap-5">
            <PlanColumn
              initial={plan}
              taskTypes={taskTypeRows.map((o) => ({ key: o.key, tone: o.tone }))}
              followUps={followUps}
              activities={activities}
              actionCategories={actionCategories}
              afterDay={<ListingPostQueue viewer={viewer} />}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── ภาพรวมทีม ────────────────────────────────────────────────────────
     The manager/admin/support landing screen, rebuilt 2026-08-28 from the
     Habihub Sales Dashboard's Overview tab — the screen leadership already
     reads every day. It replaces four stat tiles, a personal goal ring, a
     five-row "recent listings" table and a flat year-to-date leaderboard.

     WHY THOSE FOUR WENT. Each answered a question about a handful of rows,
     and none of them answered "how is the team doing this month", which is
     the only reason this page gets opened. The goal ring was the worst of it:
     a PERSONAL target rendered on the screen a manager uses to look at other
     people. The listings table duplicated /listings' first page.

     THE LAYOUT IS THE SOURCE'S, and its order is an argument: the output
     first (revenue against target), then what is driving it (trend and
     ranking), then the process behind that (acquisition KPIs), then the raw
     work underneath (when it happened, and of what kind). Reading down the
     page walks from result to cause.

     `intake` STAYS ON TOP. It is not a dashboard component — it is the lead
     assignment queue, gated on `intakeAssign`, and it is work waiting to be
     done rather than a number to read. Removing it would take a capability
     away, not a chart. */
  const today = bkkToday();
  const range = parseMonthRange(
    { from: param(sp, "from"), to: param(sp, "to") },
    today
  );
  const months = monthsBetween(range.from, range.to).length;
  const label = rangeLabel(range);

  // The roster indexes the KPI, heatmap and matrix cards, and bounds two of
  // their queries — hence its own await ahead of the rest.
  const team = await getSalesTeam();

  const [revenue, revenueTargets, leaders, trend, kpi, heat, matrix] =
    await Promise.all([
      getTeamRevenue(viewer, range),
      getRevenueTargets(),
      getRevenueLeaderboard(range),
      getTeamTrend(viewer, Number(today.slice(0, 4))),
      getTeamKpi(range),
      getActivityHeatmap(range.to, team),
      getActivityMatrix(range, team),
    ]);

  // The team's monthly target — the hero's goal bar over the selected span,
  // and the trend chart's dashed reference line for a single month.
  const monthlyTarget =
    revenueTargets.reduce((n, t) => n + (t.monthly ?? 0), 0) || null;

  /* Deal-derived metrics are withheld from a viewer whose deal scope is
     "none" (listing support). Drawing a flat ฿0 line and calling it the
     team's revenue is worse than not offering the series at all. */
  const metrics: TeamMetric[] = [
    ...CORE_TEAM_METRICS.filter((m) => canSeeDeals || !DEAL_METRICS.has(m.key)),
    ...trend.categories.map((c) => ({
      key: actionMetric(c),
      label: c,
      fmt: "count" as const,
    })),
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {header}
      {seatPicker}

      <div className="border-b border-line pb-3">
        <MonthRangePicker range={range} today={today} />
      </div>

      {intake}

      {canSeeDeals && (
        <TeamRevenueHero
          range={range}
          months={months}
          today={today}
          revenue={revenue}
          targets={revenueTargets}
          canEdit={viewer.perms.targetsSet}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <TeamTrendCard
            trend={trend}
            metrics={metrics}
            monthlyTarget={monthlyTarget}
          />
        </div>
        <div className="xl:col-span-2">
          {canSeeDeals ? (
            <RevenueLeaderboardCard rows={leaders} label={label} />
          ) : (
            <TeamKpiCard
              kpi={kpi}
              team={team}
              label={label}
              months={months}
              canSet={viewer.perms.targetsSet}
            />
          )}
        </div>
      </div>

      {canSeeDeals && (
        <TeamKpiCard
          kpi={kpi}
          team={team}
          label={label}
          months={months}
          canSet={viewer.perms.targetsSet}
        />
      )}

      <ActivityHeatmapCard
        cells={heat}
        team={team}
        monthKey={range.to}
        today={today}
      />

      <ActivityMatrixCard matrix={matrix} team={team} label={label} />
    </div>
  );
}
