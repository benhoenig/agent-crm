# Data Model & Feature Spec

> **Provenance (2026-09-11).** This spec was written for the Habihub CRM, from which this
> codebase was cloned. The schema, roles, options catalog and feature set below are what the
> code still implements. Two things differ in this project: it deploys on **Vercel** (not
> Cloudflare Workers), and R2 is reached over the **S3 API** (`lib/media/r2.ts`) rather than a
> Worker binding. §1 (source-system inventory) describes Habihub's spreadsheets and does not
> apply here — this project starts with an empty database.

> **Status:** DRAFT for sign-off · Documented 2026-08-15
> **What this is.** The schema + feature spec for the Habihub CRM, derived from a full read of
> the live Google Sheets ecosystem (below) and using [haus-crm](https://github.com/benhoenig/haus-crm)
> as the feature playbook. Per the haus-crm handover doctrine: **one-time import, auth first,
> CRM becomes the system of record on day one.** The sheets are retired after go-live.
>
> **Stack (decided 2026-08-15):** Next.js 15 + Tailwind v4 · **Neon Postgres** + Drizzle ORM ·
> **Better Auth** · **Cloudflare R2** (listing photos) · deployed on **Cloudflare Workers**
> via `@opennextjs/cloudflare` (free `*.workers.dev` URL until a domain is chosen).
> Design: dark surface + lime accent per `design reference/reference dashboard.jpg`,
> plus a full light theme (toggle, dark default). Type: **Sarabun** (มีหัว) for text,
> **IBM Plex Mono** for numerals (`.num`) — decided 2026-08-15 after trialing IBM Plex
> Sans Thai loopless/Looped.

---

## 1. Source system inventory

| Spreadsheet | Key tabs | Role |
| :-- | :-- | :-- |
| **HABIHUB Database** (`17C2OOb7…`) | All Listings (1,614×72) · Active Lead (610×32) · Lead Submission · Zone · Employee · Resources (enum master, 41 cols) · Action · `_raw_revenue` (deals) · LINE User Id · Action Log Keyword · ~20 `summary_*` tabs | Central aggregate + automation hub |
| **Sales Sheets × 6** (Do, Ploy, Stang, Su, Hola, Tun; Template `1vhb8g0…`) | Listings (72 cols) · Buyer Focus (32) · Projects (49) · Last Match (16) · Actions (10) · Goals & Target (13) · Listing Update · Feedback · Listing Schema | **Per-agent working copies — the real data entry surface** |
| **HABIHUB Listing Support Sheet** (`16FyynJ…`) | Listings mirror · Listing Update · Update Form (82 cols) | Admin/support listing-update workflow |
| **HABIHUB HR Sheets** (`1E-lmJm…`) | Employee Lists (31 cols) · Zone (16, duplicate of central) · User : Pass | People master + plaintext credentials |
| Finance · CEO Report · Content Management | — | **Out of CRM v1 scope** (see §8) |

### Critical observations (verified against live data)

1. **The central rollup is broken.** `Owner Contact`, `Project`, `Project Persona`, `Last Match`
   in HABIHUB Database are QUERY-formulas over the agent sheets and every one currently shows
   `#VALUE! (NO_COLUMN: Col3)`. The agent sheets are the source of truth for those entities;
   the import must read from the 6 agent sheets, not the central tabs.
2. **`All Listings` and `Active Lead` (central) DO have data** — they are aggregated by the
   `habihub-dashboard@gen-lang-client-0717035807` service account (last write 2026-08-15).
   Import verification must reconcile central row counts against the sum of agent sheets.
3. **Owner data is embedded in unlabeled listing columns P–R** (name / phone / LINE) — the
   dedicated Owner Contact table never worked. Import builds the `owners` table from the
   listing-embedded values + dedup by phone.
4. **Two-plus listing ID schemes coexist:** `HBH-ST-1` (current, zone-coded), `SAT001`
   (Listing Update log), `TDMK007` / `TRP2015` (Lead Submission, project-coded, Nov-2025 era).
   Import keeps the sheet ID as `legacy_code` (unique, nullable) and mints stable internal IDs.
5. **An existing LINE OA bot automation** writes `Lead Submission` (with LINE `userId`) and
   parses agent chat messages via `Action Log Keyword` → `Action` log. Agents have LINE User
   IDs on file. **Decided (Ben, 2026-08-15): both flows retire at go-live.** The CRM's only
   LINE feature is the `/plan`-family daily-plan command (§7); lead intake and action logging
   move fully in-app.
6. **Plaintext credential stores exist** (`_auth` tab, HR `User : Pass`). These are **never
   imported** — Better Auth replaces them; tabs get deleted after go-live.
7. **Follow-up SLAs are encoded in conditional formatting** — this is real business logic:
   - Listings (by Potential): `A` >15d · `B` >30d · `C` >60d · `Exclusive` >7d → overdue
   - Listing post-freshness (col O, วันที่ Follow): `A` >14d · `B`/`C` >30d · `Exclusive` >7d
   - Leads (by Potential): `A` >3d · `B` >7d · `C` >14d → overdue
   These become a `sla_rules` config table driving overdue flags + the daily-plan queue.
8. **Thai-locale data mess to normalize at import** (one pass, no fallback):
   d/m/yyyy dates, ISO timestamps, and Buddhist-era dates (`05/01/69`) mixed in the same
   columns; currency as `฿10,500,000` strings; lead Budget in millions (`3.89`); phone
   garbage (`: 098-2-636264`); `\xa0` whitespace; `'FALSE'` strings for booleans; zone names
   mixed Thai/Eng in employee assignments; `#VALUE!` cells.

---

## 2. Proposed schema (Neon Postgres)

Conventions: `id` UUID PK · `created_at`/`updated_at` timestamptz · `legacy_code` text unique
nullable for imported sheet IDs · enums as Postgres enums where values are stable, FK to
master-data tables where the business edits them (statuses/types = enums; zones/stations/
projects = tables). All user-facing Thai enum values preserved verbatim.

### People & access
- **`users`** — Better Auth identity + profile. From HR Employee Lists: employee_code,
  status, division, position, second_position, team, names (Eng/Thai), nickname, gender,
  nationality, phone ×2, id_card_no, address, email, work_email, birthday, date_started,
  agreement_files, emergency contact ×3, remark, avatar_url (→ R2), **role**
  (`admin` | `manager` | `sales` | `support` — seed matrix in §6), **line_user_id**.
- **`sessions` / `accounts`** — Better Auth internals.
- **`user_zones`** — M:N user ↔ zone (agents own multiple zones; zones transfer).

### Geography & master data
- **`zones`** — code (`SAT-001`), name_eng, name_thai, location. ~16 live (Bangkok CBD).
- **`transit_stations`** — type (`BTS`|`MRT`|`ARL`), code (`S05`), name. Full master lists
  captured from Listing Schema (83 BTS + 139 MRT + 8 ARL).
- **`sla_rules`** — entity (`listing_follow`|`listing_post`|`lead_follow`), potential, max_days.
- **`enum reference`** (Postgres enums, values from Resources tab):
  - listing_status: โพสต์แล้ว · ข้อมูลครบ รอโพสต์ · ข้อมูลยังไม่ครบ · Update ข้อมูล ·
    เอาประกาศลงชั่วคราว(+✅) · แคนเซิลประกาศ(+✅) · เช่าแล้ว ✅ · ขายแล้ว ✅ · Reserved ·
    เช่าแล้วเอเจ้นอื่น ✅ · ขายแล้วเอเจ้นอื่น ✅
  - listing_type: Sale · Rent · Sale & Rent · Sale with Tenant · Co-Agent
  - potential: A · B · C · Exclusive (listings) / A · B · C · New Lead (leads)
  - property_type: บ้านเดี่ยว · บ้านแฝด · ทาวน์เฮ้าส์ · ทาวน์โฮม · คอนโด · ที่ดิน ·
    อพาร์ทเม้นท์ · โรงแรม · ออฟฟิศ · โกดัง · โรงงาน · อาคารพาณิชย์
  - pipeline_stage: Lead → Call → Follow → Appoint → Show → Nego → Close → Win
  - lead_status: Active · Lose · Reject · Sold · Cancel
  - case_status: Completed · Failed · Cancel (+ Success!)
  - unit_condition: Great · Good · Bad · Broken · location_grade: A · B · C
  - direction (8), unit_position (10), price_remark (3), last_match_type,
    marketing_channel (Ddproperty · Livinginsider · Facebook Organic/Ad · ป้าย Offline ·
    Referral · อื่นๆ), contact_by (Call · LINE OA · FB/DD/LV Inbox · Email · Personal),
    lead_type (Owner - Sale/Rent/Others · Buyer - Buy/Rent · Co-Agent),
    action_category (New List · Owner Visit · Owner Talk · Survey · Call · Follow · Appoint ·
    Show · Nego · Close · โอนกรรมสิทธิ์ · เปลี่ยนน้ำ,ไฟ · เปิดประเมิน · ประชุม ·
    ทำงานหน้าคอม · อื่นๆ), closing_status (Reserved · Sign Contract · Banking · EX · Done ·
    Com. Paid …), goal_status, complain severity/status, ads enums (Objective · Message Type ·
    Targeting · Format · Performance) reserved for a later marketing module.

### Contacts
- **`owners`** — from listing-embedded data + broken Owner Contact schema: name, phone,
  line_id, email, gender, nationality. Privacy-scoped (§6).
- **`contacts` (buyers)** — from Active Lead person fields: name, phone, line_id, email,
  gender, nationality, age_range. Deduped by phone at import; leads reference a contact.

### Property domain
- **`projects`** — the 49-col knowledge base: names (Eng/Thai), property_type, zone FK,
  developer, year_built, buildings/floors/units, parking ratio + rules, common-fee
  (rate + unit + payment terms + collection %), juristic person, avg price/sqm, rental yield,
  unit types, ceiling height, units/floor, segment, comparables, best view/direction/position,
  nationality mix, pets/smoking, shops, nearest station + distance, shuttle, keywords,
  target customers, concept, pros/cons, **earthquake assessment ×6 fields**, created_by.
- **`project_personas`** — normalized rows (agent sheets store Persona 1–10 as columns):
  project FK, sales FK, persona text, trust_trigger.
- **`listings`** — core entity, normalized from the 72-col sheet:
  - identity: legacy_code (`HBH-ST-1`), zone FK, project FK (nullable), listing_name
    (auto-generated display name), status, potential, listing_type, agent FK, created dates,
    posted_at, closed_at (both drive days-to-sell)
  - specs: property_type, in_project, street_soi, location_grade, station FKs (BTS/MRT/ARL),
    unit_type_name, unit_no, bed, bath, maid_room, land (ไร่/งาน/วา), usable_sqm, floor,
    building, view, direction, position, parking, unit_condition
  - pricing: asking_price, rental_price, price_remark, price_per_sqw / price_per_sqm
    (computed), plus admin remark / current-vs-new data update fields → folded into the
    `listing_updates` audit log rather than kept as 3 mutable text columns
  - owner: owner FK · owner_talk_count · last_followed_at
  - content: post_remark, remark_cream, google_maps_link
- **`listing_media`** — R2-backed: listing FK, kind (`original` | `new_photo` | `shorts_reel`
  | `hometour`), r2_key, source_drive_url (import provenance), sort order. Replaces the four
  Drive-folder link columns.
- **`listing_channels`** — per-portal marketing state: listing FK, channel (Ddproperty ·
  Livinginsider · PropertyHub · FB Group · FB Page), url, boosted (DD/LV/PH Boost flags),
  last_pushed_at (วันที่ดันล่าสุด), marketing_report_link, facebook_ad_doc.
- **`listing_updates`** — audit/change-request log (from Listing Update + Support Sheet
  Update Form): listing FK, edited_at, column, old_value, new_value, status, requested_by.

### Sales domain
- **`leads`** — from Active Lead (32 cols) + Lead Submission intake: contact FK, listing FK
  (nullable — `Initial Interested` free-text kept), lead_type, source
  (marketing_channel + contact_by), potential, lead_status, pipeline_stage, progress,
  background/requirement/pain_point, budget_million, timeline, last_followed_at,
  activity_comment, assigned_to FK, created_by FK, intake metadata (submitted_at, LINE
  user_id, admin who assigned, complain fields), case closing: commission, bank_loan,
  closing_unit, closing_date, transfer_date, closing_remark, case_status.
- **`deals`** — from `_raw_revenue` (28 cols): listing FK, lead FK (nullable — historic rows
  won't all link), type, closing_price, commission, sales FK, co_agent, closing_date,
  transfer_date, closing_status, reservation_amount, document links (closed-case file,
  receipts, SPA, agent agreement → R2 keys + legacy Drive URLs), buyer/seller legal
  identity (fullname, address, ID no. — **PII, admin-scoped**).
- **`last_matches`** — from agent-sheet 16-col version: by FK, type (ปิดเอง · คนอื่นปิด ·
  เจ้าของขายเอง · เอเจ้นอื่นขายไป · ไม่รู้), project name (+ FK where matchable), potential,
  property_type, zone FK, price, bed/bath, sqm, floor, tower, direction, remark, buyer_persona.

### Activity & performance
- **`actions`** — activity log (from per-agent Actions + LINE-bot-parsed central Action):
  date, agent FK, category, quantity, hours, remark, recap (Work / Not Work), what_happened,
  why, improvement_plan. Optional listing/lead FK for future row-linking (sheet data has none).
- **`goals`** — from Goals & Target: name, agent FK, goal_type, target_amount, start/target
  dates, status (Planned · In Progress · Success! · Failed · Cancel), remark + retro fields.
- **`feedback`** — tool feedback log (date, category, tool, feedback, description).
- **`notifications`** — in-app.
- **`leave_allowances`** — user FK, year, days by type (decided: in v1 despite empty source —
  starts fresh, modeled on haus-crm's leave feature).
- **`leaves`** — user FK, start/end date, type, status (requested → approved/rejected),
  approved_by FK, remark.
- **`daily_plan_tasks`** — user FK, date, order, title, done, linked entity (listing/lead FK
  nullable), start_time. Backs `/today` and the LINE plan card (§7). SLA-generated queue items
  are computed, not stored; this table holds the agent's own planned tasks.

### Deliberately dropped from the sheet model
- `summary_*`, Report, Leaderboard, Fease tabs — **derived data**; rebuilt as SQL queries /
  materialized views behind the dashboard, never stored as tables.
- `ชีต14`, `Active Lead5`, `*_backup` tabs — stale copies; used only to cross-check import counts.
- `_auth`, `User : Pass` — replaced by Better Auth (§1.6).

---

## 3. Feature surfaces (v1)

Mirrors haus-crm's map, adapted to Habihub's data. Same-order build within Phase 3–5.

| Surface | From | Notes |
| :-- | :-- | :-- |
| `/login` | — | Better Auth email+password; roles from seed matrix |
| `/` dashboard | reference design + `summary_*`/Report/Leaderboard | KPI cards (revenue, commission, leads, listings), pipeline funnel, leaderboard, activity heatmap, notifications |
| `/today` | haus DailyPlan + SLA rules | Overdue queues (listing follow, lead follow, post-freshness), action logging with recap |
| `/listings` + detail | 72-col sheet | Browser w/ SLA badges, intake form, R2 photo gallery, channel/boost panel, price history, owner card (privacy-scoped), copy-for-post |
| `/listing-updates` | Support Sheet workflow | Change-request queue for admin/support role |
| `/leads` + detail | Active Lead + Lead Submission | Pipeline stages, timeline, intake (manual + LINE feed), assignment, complains |
| `/pipeline` | — | Retired 2026-08-30; redirects to `/leads`. Stage moves live on the lead drawer's stepper |
| `/deals` | `_raw_revenue` | Closed-deal ledger, commission status, document vault (R2), buyer/seller legal (admin-only) |
| `/projects` + detail | 49-col knowledge base | Including earthquake assessment section + personas |
| `/last-match` | Last Match | Scoped own/team/all like haus |
| `/owners` | owners table | Privacy-scoped contact book |
| `/team` + detail | HR Employee Lists | Employee records, zone assignment |
| `/goals` | Goals & Target | Targets board with retro |
| `/leave` | (no sheet source — starts fresh) | Leave requests + approvals + allowances, modeled on haus-crm |
| `/settings` | Zone/Resources/SLA | Master data managers, roles, SLA rules editor |
| `POST /api/line/webhook` | Solo Gang port (§7) | `/plan` · `/<name>plan` · `/link` · `/groupid` |

**Not in v1** (exists in haus-crm, no Habihub source): checklist templates, probation —
additive later without schema damage.

---

## 4. One-time import plan

1. **Export** all 6 agent sheets + central All Listings / Active Lead / Lead Submission /
   `_raw_revenue` / Zone / Employee + HR Employee Lists via Sheets API to raw JSON, archived
   in the repo (`import/raw/`).
2. **Reconcile**: agent-sheet Listings ∑ vs central All Listings (1,614); Buyer Focus ∑ vs
   Active Lead (610); every mismatch listed and resolved, not skipped.
3. **Normalize** (§1.8) with a typed transform script — every rule unit-tested against real
   rows; rejects go to a manual-review CSV, target zero.
4. **Entity extraction**: owners from embedded cols (dedup by phone), contacts from leads,
   project-name → project FK matching (name-normalized, manual map for stragglers),
   Lead Submission ↔ Active Lead matching by phone + listing code.
5. **Photos → R2**: walk each listing's Drive folders (4 media kinds), upload to R2 under
   `listings/{id}/{kind}/{n}.jpg`, record `source_drive_url`. Deal documents likewise under
   `deals/{id}/…`. Drive stays as archive.
6. **Verify**: row counts, sum of closing prices vs Report revenue, spot-check per agent,
   then a sign-off checklist before the sheets are frozen read-only.

---

## 5. Auth & roles (§6 in haus terms)

Better Auth (email+password; email = existing Gmail addresses from Employee Lists).
Sessions server-side in Neon. Scoping enforced in the query layer (no RLS — single app,
single DB role; every query goes through scoped repository functions).

Seed role matrix (adapted from haus-crm's; to confirm):
- **admin** (Stang, Do per HR sheet) — everything, incl. deal legal PII + settings
- **manager** — team-wide listings/leads/deals, no settings, no legal PII
- **sales** — own + zone-scoped listings/leads; owner contacts visible only on own listings;
  last-match own/team/all toggle like haus
- **support** — listing-update queue, intake assignment; no deals

---

## 6. R2 layout

Bucket `habihub-crm` (private) + Worker-signed delivery route (no public bucket):
`listings/{listing_id}/{kind}/{seq}.{ext}` · `deals/{deal_id}/{doc_type}/…` ·
`avatars/{user_id}.{ext}`. Upload via presigned URLs from the app; images served through
the Worker with cache headers (R2 egress to Workers is free).

---

## 7. LINE integration (decided 2026-08-15)

**The CRM's only LINE feature is the daily-plan command**, ported from the Solo Gang
dashboard (`app/api/line/webhook/route.js` + `lib/line-flex.js` in
`…/Client/Solo Gang`):

- `POST /api/line/webhook` — LINE-signature-verified; **group-only** commands, silent
  otherwise. Groups are allowlisted by `line_group_id` on a team/settings record; commands
  resolve only against that group's members.
- `/plan` → sender's own plan (via their linked `line_user_id`) · `/<name>plan` → that
  agent's plan by nickname/handle · `/link <name>` → binds sender's LINE userId ·
  `/groupid` → setup helper.
- Reply is a Flex bubble (`personalPlanCard` port, restyled to the Habihub design tokens):
  avatar, monthly goal % (from `goals`), today's checklist with done/total tally
  (from `daily_plan_tasks`), leave-day state (from `leaves`), CTA button into the CRM.
- Replies are free (no LINE push quota). Existing agent `line_user_id`s import from the
  LINE User Id tab, so `/link` is only needed for new joiners.
- Solo Gang's morning **push** (`dailyTeamCard` via cron) is NOT in scope; trivially
  addable later if wanted.

**Retired at go-live:** the LINE lead-submission flow and the keyword-parsed action log
(`Action Log Keyword`), replaced by in-app intake and `/today` logging. The
`habihub-dashboard` service-account aggregation dies with the sheets (see open decision §9.1
about anything still consuming `summary_*`).

---

## 8. Out of scope (v1)

Finance sheet (COA/accounting), CEO Report, Content Management, Facebook Ads management
(enums reserved in §2), HR User:Pass portal-credential vault (dies with the sheets),
per-agent sheet sync (one-way import only, sheets retired).

---

## 9. Decisions log

**Decided (Ben, 2026-08-15):**
- LINE bot → daily-plan command only (§7); lead intake + action-keyword flows retire.
- Leave module → **build in v1** (empty start, haus-crm model).
- Deal legal PII → **import, admin-scoped** (Neon encrypts at rest; role gate in query layer).
- Zone master → the "519-row" HR Zone tab turned out to be grid size, not data: both Zone
  tabs hold the **same 16 zones**. Master = those 16; new zones added via `/settings`.

**Still open:**
1. **External dashboard**: does anything besides the sheets consume `summary_*` today
   (e.g. a Looker/AppSheet the CEO uses)? Determines whether we ship a read-only view.
2. **Repo name**: `habihub-crm`?
