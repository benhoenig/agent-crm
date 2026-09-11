# Agent CRM

A real-estate agency CRM (listings, leads, deals, projects, planner, ledger,
LINE integration), in Thai. Cloned from the Habihub CRM on 2026-09-11 with an
empty database; the product name lives in `lib/brand.ts` and is the one place
to change when the client's brand is decided.

**Stack.** Next.js 15 (App Router, server actions) · Tailwind v4 · Neon
Postgres + Drizzle ORM · Better Auth (email/password + LINE Login) ·
Cloudflare R2 for media, over the S3 API · deployed on **Vercel** (`sin1`,
next to the database in Singapore). `DATA_MODEL.md` is the schema and feature
spec.

## Local setup

```bash
pnpm install
cp .env.example .env      # then fill it in — see the comments in the file
pnpm db:migrate           # applies ./drizzle to DATABASE_URL
pnpm db:seed              # transit stations + SLA rules (idempotent)
pnpm user:create -- --email you@example.com --password '…' --name You --role superadmin
pnpm dev
```

Point `DATABASE_URL` at a **development branch** of the Neon project for local
work. Seeding and scratch users against production is how live data gets
polluted.

## Scripts

| Script | What it does |
| :-- | :-- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint` / `pnpm typecheck` | ESLint · `tsc --noEmit` |
| `pnpm db:generate` | drizzle-kit: new migration from schema changes in `lib/db/schema` |
| `pnpm db:migrate` | apply `./drizzle` over the Neon HTTP driver (the one the app uses) |
| `pnpm db:seed` | master data: BTS/MRT/ARL stations, SLA rules |
| `pnpm user:create` | provision an account (public sign-up is off) |
| `pnpm roles:audit` | report role/permission drift |
| `pnpm line:preview` | render the LINE Flex plan card for the Flex simulator |

Zones (the client's coverage areas) are entered in **Settings › โซน**, not
seeded — they belong to the client, not the codebase.

## Environment variables

Everything is listed and explained in `.env.example`. On Vercel, set the same
names as project environment variables. Three are required for the app to
boot at all: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Media
needs the four `R2_*` variables. The nightly retention job needs
`CRON_SECRET`. LINE and OpenAI are optional — each feature stays disabled
until its keys exist.

## Deploying on Vercel

1. Import the GitHub repo into Vercel (framework: Next.js, package manager:
   pnpm — both auto-detected).
2. Set the environment variables above. `BETTER_AUTH_URL` is the production
   origin (`https://<domain>`); register `${BETTER_AUTH_URL}/api/auth/line/callback`
   in the LINE Login channel if LINE sign-in is used.
3. Run `pnpm db:migrate` against the production `DATABASE_URL` once from your
   machine (migrations are not run during the Vercel build, on purpose — a
   build should not be able to change the schema).
4. Deploy. `vercel.json` pins the region to `sin1` and registers the cron.

`GET /api/version` returns the commit the live site was built from, so "is
the latest code live?" is one request away.

### Scheduled jobs

`vercel.json` registers one cron: `GET /api/cron/retention` daily at 19:00
UTC (02:00 Bangkok). It deletes `record_views` rows older than
`VIEW_RETENTION_DAYS` (`lib/retention.ts`). Vercel sends
`Authorization: Bearer ${CRON_SECRET}`; the route rejects anything else.

### Media uploads

Listing media, project photos and avatars are posted through server actions
and written to R2 by `lib/media/r2.ts`; delivery goes through the
session-gated `/media/[...key]` route, so the bucket stays private.

**Known constraint.** Vercel serverless functions reject request bodies over
4.5 MB, regardless of the 25 MB `serverActions.bodySizeLimit` in
`next.config.ts` (that ceiling is Next's, and Vercel's is lower and applies
first). Photos are fine; a phone video or a large PDF will fail to upload.
The proper fix, when it is needed, is presigned PUT URLs so the browser
uploads straight to R2 — which also requires a CORS rule on the bucket.
