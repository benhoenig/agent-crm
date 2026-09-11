import "dotenv/config";
import { asc } from "drizzle-orm";
import { getDb } from "../lib/db";
import { roles } from "../lib/db/schema";
import { ROLE_MATRIX, type Role, type RolePermissions } from "../lib/auth/roles";

/* Diff the shipped permission matrix against the one the app actually
 * enforces — `pnpm roles:audit`.
 *
 * WHY THIS EXISTS. The live matrix is DATA (the `roles` table, editable at
 * /settings/roles) and ROLE_MATRIX in lib/auth/roles.ts is only the seed. That
 * is the right design — the client renames and re-tunes roles without a
 * deploy — but it means the code can say one thing while production does
 * another, indefinitely, with nothing to notice. It has now happened twice:
 *
 *   0034  `targetsSet` was added to the code and never migrated. Missing from
 *         the row, parsePerms degraded it to the SALES value, and for three
 *         weeks nobody in the company could set a target.
 *   0037  three permissions were turned OFF in the code and never migrated.
 *         The rows kept their original `true`, so five people held duties that
 *         had been deliberately taken away from them.
 *
 * THOSE TWO FAILURES ARE NOT EQUALLY LOUD, and the exit code reflects it:
 *
 *   MISSING KEY      always a bug, and a silent one — parsePerms substitutes
 *                    the sales value on every read, so the role behaves in a
 *                    way nobody wrote down anywhere. Fails the audit.
 *   MISSING ROLE     same: the app falls back to the code seed for a row that
 *                    should exist. Fails.
 *   VALUE DIFFERS    reported, but NOT a failure. Editing a role in Settings
 *                    is a supported act and is supposed to win — treating
 *                    every difference as an error would make the audit cry
 *                    wolf the first time somebody legitimately tunes a role.
 *                    A human reads these and decides.
 *   EXTRA ROLE       a custom role. Noted, never a problem.
 */

const PERM_KEYS = Object.keys(ROLE_MATRIX.sales) as (keyof RolePermissions)[];

async function main() {
  const live = await getDb().select().from(roles).orderBy(asc(roles.sortOrder));
  const liveById = new Map(live.map((r) => [r.id, r]));

  const missingRoles: string[] = [];
  const missingKeys: string[] = [];
  const differences: string[] = [];

  for (const id of Object.keys(ROLE_MATRIX) as Role[]) {
    const row = liveById.get(id);
    if (!row) {
      missingRoles.push(id);
      continue;
    }
    const stored = (row.perms ?? {}) as Record<string, unknown>;
    for (const key of PERM_KEYS) {
      const want = ROLE_MATRIX[id][key];
      if (!(key in stored)) {
        missingKeys.push(
          `${id}.${key} — absent from the row; every read silently uses the sales value (${String(ROLE_MATRIX.sales[key])})`
        );
      } else if (stored[key] !== want) {
        differences.push(
          `${id.padEnd(16)} ${key.padEnd(20)} code=${String(want).padEnd(12)} live=${String(stored[key])}`
        );
      }
    }
  }

  const extra = live.filter((r) => !(r.id in ROLE_MATRIX)).map((r) => `${r.id} (${r.name})`);

  console.log(`roles in code: ${Object.keys(ROLE_MATRIX).length} · in database: ${live.length}\n`);

  if (missingRoles.length) {
    console.log("MISSING ROLES — the app falls back to the code seed for these:");
    for (const r of missingRoles) console.log(`  ${r}`);
    console.log();
  }
  if (missingKeys.length) {
    console.log("MISSING PERMISSIONS — silently degraded on every read:");
    for (const k of missingKeys) console.log(`  ${k}`);
    console.log();
  }
  if (differences.length) {
    console.log("DIFFERENT VALUES — intentional if somebody edited the role in ตั้งค่า, a missed migration otherwise:");
    console.log(`  ${"role".padEnd(16)} ${"permission".padEnd(20)} ${"code".padEnd(17)}live`);
    for (const d of differences) console.log(`  ${d}`);
    console.log();
  }
  if (extra.length) {
    console.log(`custom roles (not in the code seed, which is fine): ${extra.join(", ")}\n`);
  }

  const broken = missingRoles.length + missingKeys.length;
  if (broken === 0 && differences.length === 0) {
    console.log("✓ the live matrix matches the code exactly");
  } else if (broken === 0) {
    console.log(`${differences.length} value difference(s) — nothing degraded; review the list above`);
  }
  process.exit(broken > 0 ? 1 : 0);
}

main();
