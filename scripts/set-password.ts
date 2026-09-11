import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import * as schema from "../lib/db/schema";
import { accounts, users } from "../lib/db/schema";

/**
 * Reset an EXISTING account's password from the CLI.
 *
 * `user:create` cannot do this — it calls signUpEmail, which fails on an email
 * that already exists. The app's own reset (settings/accounts-actions.ts
 * resetAccountPassword) goes through auth.api.setUserPassword, which requires
 * an authenticated admin session and so is unusable from a script.
 *
 * So this hashes through Better Auth's OWN hasher (auth.$context.password) and
 * writes the credential row directly. Hand-rolling scrypt here would produce a
 * hash sign-in silently rejects — the format has to come from the library.
 *
 * Targets whichever DATABASE_URL is in the environment, so production is an
 * explicit override on the command line, never a change to .env:
 *   pnpm tsx scripts/set-password.ts --email a@b.com --password secret123
 *   DATABASE_URL="<prod>" pnpm tsx scripts/set-password.ts --email … --password …
 */
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const email = arg("email");
  const password = arg("password");
  if (!email || !password) {
    console.error(
      "Usage: pnpm tsx scripts/set-password.ts --email <email> --password <password>"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const db = getDb();
  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email));
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  // Same config the app builds, so the hash parameters match exactly.
  const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
    emailAndPassword: { enabled: true },
    advanced: { database: { generateId: "uuid" } },
  });
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  const updated = await db
    .update(accounts)
    .set({ password: hash, updatedAt: new Date() })
    .where(
      and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential"))
    )
    .returning({ id: accounts.id });

  if (updated.length === 0) {
    // No credential row yet — an account provisioned without a password.
    await db.insert(accounts).values({
      id: crypto.randomUUID(),
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Created credential for ${email} (${user.name})`);
  } else {
    console.log(`Password reset for ${email} (${user.name})`);
  }
}

main().then(() => process.exit(0));
