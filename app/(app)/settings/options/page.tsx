import Link from "next/link";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { allOptions } from "@/lib/repo/options";
import { KIND_GROUPS, OPTION_KINDS, kindDef } from "@/lib/options/kinds";
import { LEDGER_SECTIONS } from "@/lib/ledger";
import { param, type Search } from "@/lib/search-params";
import {
  OptionsManager,
  type OptionItem,
} from "@/components/settings/OptionsManager";

export const dynamic = "force-dynamic";

/** rows-per-key across every column that stores this kind — shown on each
    row and in the archive confirm, so a rename/hide says what it touches. */
async function usageCounts(kind: string): Promise<Map<string, number>> {
  const def = kindDef(kind);
  const map = new Map<string, number>();
  if (!def) return map;
  for (const c of def.columns) {
    // Config columns (sla_rules) are keyed by the value, not users of it —
    // renamed with the key, never counted as usage. No data column is scoped,
    // so the plain group-by below stays correct.
    if (c.config) continue;
    const res = await getDb().execute(
      sql`select ${sql.identifier(c.column)} as key, count(*)::int as n from ${sql.identifier(
        c.table
      )} where ${sql.identifier(c.column)} is not null group by 1`
    );
    for (const r of res.rows as { key: string; n: number }[]) {
      map.set(r.key, (map.get(r.key) ?? 0) + r.n);
    }
  }
  return map;
}

export default async function OptionsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const kind = param(sp, "kind") || OPTION_KINDS[0].kind;
  const def = kindDef(kind) ?? OPTION_KINDS[0];

  const [rows, usage, allRows] = await Promise.all([
    allOptions().then((all) => all.filter((o) => o.kind === def.kind)),
    usageCounts(def.kind),
    allOptions(),
  ]);
  const ledgerCategories = allRows
    .filter((o) => o.kind === "ledger_category" && !o.archived)
    .map((o) => o.key);

  const toItem = (o: (typeof rows)[number]): OptionItem => ({
    id: o.id,
    key: o.key,
    tone: o.tone,
    role: o.role,
    section: o.section,
    linkedKey: o.linkedKey,
    scope: o.scope,
    system: o.system,
    usage: usage.get(o.key) ?? 0,
  });
  const active = rows.filter((r) => !r.archived).map(toItem);
  const archived = rows.filter((r) => r.archived).map(toItem);

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      {/* kind picker — grouped by domain so 25 kinds read as 4 clusters */}
      <Card className="self-start p-2">
        <nav>
          {KIND_GROUPS.map((g) => {
            const kinds = OPTION_KINDS.filter((k) => k.group === g.key);
            if (kinds.length === 0) return null;
            return (
              <div key={g.key}>
                <div className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-[0.14em] text-ink-3 uppercase">
                  {g.title}
                </div>
                <div className="flex flex-col">
                  {kinds.map((k) => (
                    <Link
                      key={k.kind}
                      href={`/settings/options?kind=${k.kind}`}
                      className={cn(
                        "rounded-ctl px-3 py-1.5 text-sm transition-colors",
                        k.kind === def.kind
                          ? "bg-accent-soft font-semibold text-accent-text"
                          : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                      )}
                    >
                      {k.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </Card>

      <Card className="self-start">
        <div className="border-b border-line px-5 pt-4 pb-3">
          <h2 className="text-sm font-semibold">{def.title}</h2>
          <p className="pt-0.5 text-xs text-ink-3">
            {def.hint} · ลากที่จับ ⠿ เพื่อเรียงลำดับ คลิกแถวเพื่อแก้ไข
            (บันทึกอัตโนมัติ)
          </p>
        </div>
        <OptionsManager
          key={def.kind}
          kind={def.kind}
          roles={def.roles}
          extra={def.extra}
          active={active}
          archived={archived}
          sections={LEDGER_SECTIONS.map((s) => ({ key: s.key, title: s.title }))}
          linkedCategories={ledgerCategories}
        />
      </Card>
    </div>
  );
}
