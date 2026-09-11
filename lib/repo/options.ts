// Options repository — the editable picklists (lib/options/kinds.ts).
// One cached query per request serves every picker, tone map and role
// predicate on a page. Writes live in app/(app)/settings/options/actions.ts.

import { cache } from "react";
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
  type Column,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/lib/db";
import { options } from "@/lib/db/schema";
import type { Tone } from "@/components/ui";
import type { OptionRole } from "@/lib/options/kinds";

export type OptionRow = typeof options.$inferSelect;

/** Every option row, ordered — memoized per request (React cache). */
export const allOptions = cache(async (): Promise<OptionRow[]> => {
  return getDb()
    .select()
    .from(options)
    .orderBy(asc(options.kind), asc(options.sortOrder), asc(options.id));
});

/** Active rows of one kind, in display order. */
export async function optionsFor(kind: string): Promise<OptionRow[]> {
  return (await allOptions()).filter((o) => o.kind === kind && !o.archived);
}

/** Active keys of one kind — what a <select> offers. */
export async function optionKeys(kind: string): Promise<string[]> {
  return (await optionsFor(kind)).map((o) => o.key);
}

/** Every key incl. archived — validation must keep accepting persisted rows. */
export async function allKeys(kind: string): Promise<string[]> {
  return (await allOptions())
    .filter((o) => o.kind === kind)
    .map((o) => o.key);
}

/** key → tone for Pill/Dot rendering (archived rows included so old data
    still renders in color). Pair with labels.ts `toneFor`. */
export async function toneMap(kind: string): Promise<Record<string, Tone>> {
  const map: Record<string, Tone> = {};
  for (const o of await allOptions()) {
    if (o.kind === kind && o.tone) map[o.key] = o.tone as Tone;
  }
  return map;
}

/** One map covering several kinds — for surfaces that pill mixed rows
    (e.g. /today shows listing-potential and lead-potential in one column).
    Later kinds win on key collisions; the seed keeps shared keys (A/B/C)
    identically toned so collisions are invisible. */
export async function mergedToneMap(
  ...kinds: string[]
): Promise<Record<string, Tone>> {
  const out: Record<string, Tone> = {};
  for (const k of kinds) Object.assign(out, await toneMap(k));
  return out;
}

/** Convenience for pages that render several vocabularies. */
export async function toneMaps(
  ...kinds: string[]
): Promise<Record<string, Record<string, Tone>>> {
  const out: Record<string, Record<string, Tone>> = {};
  for (const k of kinds) out[k] = await toneMap(k);
  return out;
}

/** Keys carrying a behavior role (archived rows included — a predicate must
    keep matching rows written before a value was retired). */
export async function roleKeys(
  kind: string,
  role: OptionRole
): Promise<string[]> {
  return (await allOptions())
    .filter((o) => o.kind === kind && o.role === role)
    .map((o) => o.key);
}

/** Subquery of keys carrying a role — the SQL-side twin of roleKeys, so
    predicates stay synchronous SQL fragments (no await plumbing through
    query builders) and always see the current catalog. */
function roleKeysSubquery(kind: string, role: OptionRole | OptionRole[]) {
  const roles = Array.isArray(role) ? role : [role];
  return getDb()
    .select({ key: options.key })
    .from(options)
    .where(and(eq(options.kind, kind), inArray(options.role, roles)));
}

/** WHERE fragment: column holds a key tagged with (one of) these role(s). */
export function hasRole(
  column: Column,
  kind: string,
  role: OptionRole | OptionRole[]
): SQL {
  return inArray(column, roleKeysSubquery(kind, role));
}

/** WHERE fragment: column does NOT hold this role — NULL counts as not-role,
    matching the old `is distinct from 'value'` predicates. */
export function lacksRole(
  column: Column,
  kind: string,
  role: OptionRole | OptionRole[]
): SQL {
  return or(isNull(column), notInArray(column, roleKeysSubquery(kind, role)))!;
}

/** FormData select value constrained to a kind's known keys (archived
    accepted — an edit form must be able to resubmit an old value unchanged).
    Unknown / empty → null. The options-table successor to forms.ts enumStr. */
export async function optionStr(
  fd: FormData,
  name: string,
  kind: string
): Promise<string | null> {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed === "") return null;
  return (await allKeys(kind)).includes(trimmed) ? trimmed : null;
}
