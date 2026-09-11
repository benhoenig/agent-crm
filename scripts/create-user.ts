import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import * as schema from "../lib/db/schema";
import { roles } from "../lib/db/schema";

// Admin CLI for provisioning accounts (the app itself has sign-up disabled).
// Usage:
//   pnpm user:create -- --email a@b.com --password secret123 --name Nick --role admin
//
// Uses a local Better Auth instance with sign-up enabled so the password is
// hashed exactly like the app expects; then sets the role directly in the DB
// (role is input:false in the app config, so it can never be set via HTTP).

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const email = arg("email");
  const password = arg("password");
  const name = arg("name");
  const role = arg("role") ?? "sales";

  if (!email || !password || !name) {
    console.error(
      "Usage: pnpm user:create -- --email <email> --password <password> --name <name> [--role admin|manager|sales|support]"
    );
    process.exit(1);
  }
  const db = getDb();
  const roleIds = (await db.select({ id: roles.id }).from(roles)).map(
    (r) => r.id
  );
  if (!roleIds.includes(role)) {
    console.error(`Invalid role "${role}" (${roleIds.join("|")})`);
    process.exit(1);
  }
  const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
    emailAndPassword: { enabled: true },
    advanced: { database: { generateId: "uuid" } },
  });

  await auth.api.signUpEmail({ body: { email, password, name } });
  const [user] = await db
    .update(schema.users)
    .set({ role, emailVerified: true })
    .where(eq(schema.users.email, email))
    .returning({ id: schema.users.id });

  console.log(`Created ${role} user ${email} (${user.id})`);
}

main().then(() => process.exit(0));
