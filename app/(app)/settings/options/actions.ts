"use server";

// Options editor mutations. Every action is admin-gated (p.settings — same
// gate as the /settings layout, re-checked here because actions are their own
// entry points). Called from the client-side inline editor (OptionsManager),
// so they take plain arguments and return { ok } results the row can surface.
//
// `key` IS the stored value in referencing rows (lib/db/schema/options.ts),
// so RENAME rewrites the referencing columns listed in the kind registry in
// the same atomic batch — Neon's HTTP driver has no interactive transactions,
// but db.batch() executes as one implicit transaction.

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { options } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { OPTION_KINDS, kindDef, type KindColumn } from "@/lib/options/kinds";
import { isLedgerSection } from "@/lib/ledger";

const TONES = ["muted", "info", "good", "warn", "bad", "accent"] as const;

/** Kinds whose rows point at a ledger_category by key (`extra:
    "linkedCategory"`). Derived from the registry rather than naming
    payout_role here, so a second linking kind needs no change in this file. */
const LINKING_KINDS = OPTION_KINDS.filter(
  (k) => k.extra === "linkedCategory"
).map((k) => k.kind);

export type OptionActionResult = { ok: true } | { ok: false; error: string };

/** Fields the inline editor may change. Absent field = leave unchanged;
    explicit null = clear. Everything is re-validated per kind here. */
export interface OptionPatch {
  key?: string;
  tone?: string | null;
  role?: string | null;
  section?: string | null;
  linkedKey?: string | null;
  /** action_category only — which record's timeline offers this kind. */
  scope?: string | null;
}

/** `and entity in (...)` for a registry column that only holds part of the
    table's rows — empty fragment when the column is the kind's alone.
    `alias` qualifies it for the self-join in the collision pre-check. */
function columnScope(c: KindColumn, alias?: string) {
  if (!c.scope) return sql``;
  const col = alias
    ? sql`${sql.identifier(alias)}.${sql.identifier(c.scope.column)}`
    : sql.identifier(c.scope.column);
  return sql` and ${col} in (${sql.join(
    c.scope.values.map((v) => sql`${v}`),
    sql`, `
  )})`;
}

function assertKind(kind: string) {
  const def = kindDef(kind);
  if (!def) throw new Error(`Unknown option kind: ${kind}`);
  return def;
}

async function requireSettings() {
  await requirePermission((p) => p.settings);
}

function refresh() {
  // The catalog feeds pickers and tones everywhere; the editor page is the
  // only one that must re-render *now*. The rest are force-dynamic already.
  revalidatePath("/settings/options");
}

export async function addOption(
  kind: string,
  rawKey: string
): Promise<OptionActionResult> {
  await requireSettings();
  assertKind(kind);
  const key = rawKey.trim();
  if (!key) return { ok: false, error: "ใส่ค่าก่อนกดเพิ่ม" };
  const db = getDb();

  const [dup] = await db
    .select({ id: options.id, archived: options.archived })
    .from(options)
    .where(and(eq(options.kind, kind), eq(options.key, key)));
  if (dup) {
    return {
      ok: false,
      error: dup.archived
        ? `มี “${key}” อยู่แล้วในรายการที่ซ่อนไว้ — กด “นำกลับมาใช้” แทน`
        : `มี “${key}” อยู่แล้ว`,
    };
  }

  // append at the end of the kind
  const [last] = await db
    .select({ max: sql<number>`coalesce(max(${options.sortOrder}), -10)` })
    .from(options)
    .where(eq(options.kind, kind));

  await db
    .insert(options)
    .values({ kind, key, sortOrder: (last?.max ?? -10) + 10 })
    .onConflictDoNothing();
  refresh();
  return { ok: true };
}

export async function updateOptionFields(
  id: number,
  patch: OptionPatch
): Promise<OptionActionResult> {
  await requireSettings();
  const db = getDb();
  const [row] = await db.select().from(options).where(eq(options.id, id));
  if (!row) return { ok: false, error: "ไม่พบตัวเลือกนี้แล้ว" };
  const def = assertKind(row.kind);

  const set: Partial<typeof options.$inferInsert> = {};

  let newKey: string | null = null;
  if (patch.key !== undefined) {
    const key = patch.key.trim();
    if (!key) return { ok: false, error: "ชื่อว่างไม่ได้" };
    if (key !== row.key) {
      const [dup] = await db
        .select({ id: options.id })
        .from(options)
        .where(
          and(eq(options.kind, row.kind), eq(options.key, key), ne(options.id, id))
        );
      if (dup) return { ok: false, error: `มี “${key}” อยู่แล้ว` };
      newKey = key;
      set.key = key;
    }
  }

  if (patch.tone !== undefined) {
    if (patch.tone !== null && !TONES.includes(patch.tone as (typeof TONES)[number]))
      return { ok: false, error: "สีไม่ถูกต้อง" };
    set.tone = patch.tone;
  }

  if (patch.role !== undefined) {
    if (
      patch.role !== null &&
      !def.roles.includes(patch.role as (typeof def.roles)[number])
    )
      return { ok: false, error: "พฤติกรรมไม่ถูกต้องสำหรับรายการนี้" };
    set.role = patch.role;
  }

  if (patch.section !== undefined && def.extra === "section") {
    if (patch.section !== null && !isLedgerSection(patch.section))
      return { ok: false, error: "บล็อก P&L ไม่ถูกต้อง" };
    set.section = patch.section;
  }

  if (patch.linkedKey !== undefined && def.extra === "linkedCategory") {
    if (patch.linkedKey !== null) {
      const [cat] = await db
        .select({ id: options.id })
        .from(options)
        .where(
          and(
            eq(options.kind, "ledger_category"),
            eq(options.key, patch.linkedKey)
          )
        );
      if (!cat) return { ok: false, error: "ไม่พบหมวดบัญชีนี้" };
    }
    set.linkedKey = patch.linkedKey;
  }

  if (patch.scope !== undefined && def.extra === "activityScope") {
    /* Only the two record sides, or null. Null is a real answer — ประชุม and
       ทำงานหน้าคอม belong to no record and reach `actions` through the daily
       plan — so it is offered rather than treated as "unset". */
    if (patch.scope !== null && patch.scope !== "owner" && patch.scope !== "buyer")
      return { ok: false, error: "ต้องเลือกว่าใช้กับทรัพย์หรือลูกค้า" };
    set.scope = patch.scope;
  }

  if (Object.keys(set).length === 0) return { ok: true };

  if (newKey === null) {
    await db.update(options).set(set).where(eq(options.id, id));
    refresh();
    return { ok: true };
  }

  // Rename: the referencing rows store the key verbatim — rewrite them in the
  // same batch. Identifiers come from the code registry, never from the form.
  //
  // A column inside a unique index (sla_rules, repost_rules) can already hold
  // the new key on a row left behind by an earlier rename — the UPDATE would
  // then hit that index. Check first and name the blocker; a Postgres error
  // string is not an answer the client can act on.
  //
  // The clash is per unique KEY, not per value: repost_rules is unique on
  // (grade_key, channel_key), so renaming grade "A" → "B" only collides on
  // the channels both grades have rules for. Self-join on the rest of the
  // index (`uniqueWith`) so a harmless rename is not refused.
  for (const c of def.columns) {
    if (!c.uniqueNoun) continue;
    const shared = (c.uniqueWith ?? []).map(
      (u) => sql` and a.${sql.identifier(u)} = b.${sql.identifier(u)}`
    );
    const { rows: clash } = await db.execute(
      sql`select 1 from ${sql.identifier(c.table)} a, ${sql.identifier(
        c.table
      )} b where a.${sql.identifier(c.column)} = ${
        row.key
      } and b.${sql.identifier(c.column)} = ${newKey}${sql.join(
        shared,
        sql``
      )}${columnScope(c, "a")}${columnScope(c, "b")} limit 1`
    );
    if (clash.length > 0) {
      return {
        ok: false,
        error: `เปลี่ยนเป็น “${newKey}” ไม่ได้ — มี${c.uniqueNoun} ของ “${newKey}” ค้างอยู่ ลบทิ้งก่อนแล้วค่อยเปลี่ยน`,
      };
    }
  }

  await db.batch([
    db.update(options).set(set).where(eq(options.id, id)),
    ...def.columns.map((c) =>
      db.execute(
        sql`update ${sql.identifier(c.table)} set ${sql.identifier(
          c.column
        )} = ${newKey} where ${sql.identifier(c.column)} = ${
          row.key
        }${columnScope(c)}`
      )
    ),
    // linked_key cross-references (payout_role → ledger_category) follow too
    // — but ONLY when a ledger_category is what is being renamed, and only
    // onto the kinds that actually point at one. linked_key holds category
    // keys and nothing else, so an unscoped `where linked_key = row.key`
    // would rewrite a live payout_role → category link the moment some
    // unrelated kind happened to have an option of the same name.
    ...(row.kind === "ledger_category"
      ? [
          db
            .update(options)
            .set({ linkedKey: newKey })
            .where(
              and(
                eq(options.linkedKey, row.key),
                inArray(options.kind, LINKING_KINDS)
              )
            ),
        ]
      : []),
  ] as never);
  refresh();
  return { ok: true };
}

/** Persist a drag-reorder: the client sends the full id order of the kind's
    ACTIVE rows; sortOrder is reassigned in tens. Archived rows keep theirs. */
export async function reorderOptions(
  kind: string,
  orderedIds: number[]
): Promise<OptionActionResult> {
  await requireSettings();
  assertKind(kind);
  const db = getDb();

  const current = await db
    .select({ id: options.id })
    .from(options)
    .where(and(eq(options.kind, kind), eq(options.archived, false)))
    .orderBy(asc(options.sortOrder), asc(options.id));

  const currentIds = new Set(current.map((r) => r.id));
  const valid =
    orderedIds.length === current.length &&
    orderedIds.every((id) => currentIds.has(id));
  if (!valid) {
    // A concurrent add/archive changed the set — refuse and let the page
    // re-render with the fresh order instead of writing a partial one.
    refresh();
    return { ok: false, error: "รายการเปลี่ยนไประหว่างจัดลำดับ — โหลดใหม่แล้ว ลองอีกครั้ง" };
  }

  await db.batch(
    orderedIds.map((id, i) =>
      db
        .update(options)
        .set({ sortOrder: (i + 1) * 10 })
        .where(eq(options.id, id))
    ) as never
  );
  refresh();
  return { ok: true };
}

export async function archiveOption(id: number): Promise<OptionActionResult> {
  await requireSettings();
  const db = getDb();
  const [row] = await db.select().from(options).where(eq(options.id, id));
  if (!row) return { ok: false, error: "ไม่พบตัวเลือกนี้แล้ว" };
  // Load-bearing rows stay: their role backs a dashboard/SLA predicate.
  if (row.system) return { ok: false, error: "ค่าหลักของระบบซ่อนไม่ได้" };
  await db.update(options).set({ archived: true }).where(eq(options.id, id));
  refresh();
  return { ok: true };
}

export async function restoreOption(id: number): Promise<OptionActionResult> {
  await requireSettings();
  await getDb()
    .update(options)
    .set({ archived: false })
    .where(eq(options.id, id));
  refresh();
  return { ok: true };
}
