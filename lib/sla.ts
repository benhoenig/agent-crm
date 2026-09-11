// Follow-up SLA evaluation (DATA_MODEL §1.7). Rules live in the sla_rules
// table; these pure helpers apply them to rows already in memory (list-row
// badges). Aggregate overdue *queries* join sla_rules in SQL instead — see
// lib/repo — so both paths read the same table.

import { daysSince } from "./format";

export type SlaEntity = "listing_follow" | "listing_post" | "lead_follow";

export interface SlaRule {
  entity: SlaEntity;
  potential: string;
  maxDays: number;
}

/** The three clocks, in the order the settings tab shows them. `kind` is the
    grade vocabulary each one is keyed by — the rules table stores the grade
    text (lib/options/kinds.ts rewrites it on rename), so a clock only applies
    to grades that still exist in its kind. Client-safe: copy + keys only. */
export interface SlaEntityDef {
  entity: SlaEntity;
  /** Which editable picklist supplies this clock's grades. */
  kind: "listing_potential" | "lead_potential";
  title: string;
  /** What the clock counts from. */
  counts: string;
  /** Which rows it watches at all. */
  scope: string;
  /** Thai noun for one watched row ("ทรัพย์" / "ลูกค้า"). */
  noun: string;
}

export const SLA_ENTITIES: SlaEntityDef[] = [
  {
    entity: "listing_follow",
    kind: "listing_potential",
    title: "ตามเจ้าของทรัพย์",
    counts: "นับจากวันที่ Follow ล่าสุด — ถ้ายังไม่เคย Follow นับจากวันที่รับทรัพย์",
    scope: "ทรัพย์ที่ ‘โพสต์อยู่’ หรือ ‘กำลังเตรียม’",
    noun: "ทรัพย์",
  },
  {
    entity: "listing_post",
    kind: "listing_potential",
    title: "ความสดของโพสต์",
    counts: "นับจากวันที่โพสต์ล่าสุด",
    scope: "ทรัพย์ที่ ‘โพสต์อยู่’ และมีวันที่โพสต์แล้ว",
    noun: "ทรัพย์",
  },
  {
    entity: "lead_follow",
    kind: "lead_potential",
    title: "ตามลูกค้า Lead",
    counts: "นับจากวันที่ Follow ล่าสุด — ถ้ายังไม่เคย Follow นับจากวันที่สร้าง",
    scope: "ลูกค้าที่ยังตามอยู่",
    noun: "ลูกค้า",
  },
];

export function slaEntityDef(entity: string): SlaEntityDef | undefined {
  return SLA_ENTITIES.find((e) => e.entity === entity);
}

function maxDaysFor(
  rules: SlaRule[],
  entity: SlaEntity,
  potential: string | null | undefined
): number | null {
  if (!potential) return null;
  const rule = rules.find((r) => r.entity === entity && r.potential === potential);
  return rule ? rule.maxDays : null;
}

/**
 * Days past the SLA limit (positive = overdue by that many days).
 * `lastDate` is the entity's reference date — lastFollowedAt for follow SLAs,
 * postedAt for post freshness — with the caller supplying any fallback
 * (e.g. listedAt/createdAt when a row has never been followed).
 * Returns null when no rule applies or there is no reference date.
 */
export function overdueBy(
  rules: SlaRule[],
  entity: SlaEntity,
  potential: string | null | undefined,
  lastDate: string | null | undefined,
  today?: string
): number | null {
  const max = maxDaysFor(rules, entity, potential);
  if (max === null) return null;
  const days = daysSince(lastDate, today);
  if (days === null) return null;
  return days - max;
}
