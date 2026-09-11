/* Editable picklists — which vocabularies the client controls in Settings.
   Client-safe: types and constants only, no DB import. Reads live in
   lib/repo/options.ts, writes in app/(app)/settings/options/actions.ts.

   THE LINE BETWEEN EDITABLE AND FIXED (same rule that held in the Klaichan/
   Mook fork): a list is editable when it is *vocabulary* — words the team
   uses to sort their own work. It stays a pg enum when it is *workflow* —
   something the app branches on structurally: pipeline_stage (funnel order),
   leave/goal/listing-update statuses, media kinds, doc slots, station types.
   Renaming those is a logic change, not a preference.

   Adding a KIND is a code change (it needs a column to live in and a row in
   this registry). Adding a VALUE inside a kind is a Settings click. */

/** How code recognises an option now that its name is the client's to change.
    Fixed vocabulary owned by the app; several rows may share a role. */
export type OptionRole =
  // listing_status
  | "posted" // live on the portals — SLA repost clock runs, counts as inventory
  | "ready_to_post" // complete and queued for support to put on the portals
  | "preparing" // working inventory, not yet ready for support
  | "paused" // temporarily off market
  | "withdrawn" // cancelled, no sale
  | "closed_won" // we closed it — drives days-to-sell + dashboard wins
  | "closed_other" // another agent closed it — off market, not our win
  // lead_status
  | "hot" // top potential grades — drives the copy generator's premium tier
  | "open" // still being worked — SLA + active counts
  | "won" // closed and won
  | "lost" // lose / reject
  // closing_status (deals)
  | "settled" // commission in hand — revenue counts these ("Com. Paid")
  | "dead" // case died — no commission, ever
  // ledger_category (posting targets for lib/repo/deal-ledger.ts)
  | "commission_income" // where a deal's received commission posts
  | "commission_split" // fallback line for paid-out splits
  // employment_status
  | "departed"; // off the payroll — setting it suspends the login too

export const ROLE_LABEL_TH: Record<OptionRole, string> = {
  posted: "นับเป็น ‘โพสต์อยู่’ (นาฬิกา SLA เดิน)",
  ready_to_post: "ข้อมูลครบ — เข้าคิวให้ซัพพอร์ตโพสต์",
  preparing: "นับเป็นงานที่กำลังเตรียม",
  paused: "พักประกาศชั่วคราว",
  withdrawn: "ยกเลิกประกาศ",
  closed_won: "นับเป็นปิดการขายของเรา",
  closed_other: "ปิดโดยเอเจ้นท์อื่น",
  hot: "เกรดพรีเมียม (เทมเพลตโพสต์ใช้สำนวนขายแรง)",
  open: "นับเป็นลูกค้าที่กำลังตาม",
  won: "ปิดการขายสำเร็จ",
  lost: "เสียลูกค้า",
  settled: "ได้รับคอมมิชชั่นแล้ว",
  dead: "เคสตาย (ไม่ได้คอมมิชชั่น)",
  commission_income: "บรรทัดรายได้ค่าคอมมิชชั่น (ระบบลงให้จากดีล)",
  commission_split: "บรรทัดส่วนแบ่งคอม (ระบบลงให้จากดีล)",
  departed: "ออกแล้ว — ระงับบัญชีให้อัตโนมัติ",
};

/**
 * "Still a live piece of inventory" — the status roles that count a listing as
 * part of the book: on the portals, queued for support to put there, or being
 * prepared. Everything else (paused, withdrawn, sold) is history.
 *
 * ONE LIST, NOT EIGHT COPIES. This was written out literally as
 * ["posted", "preparing"] in eight predicates — the dashboards, the focus
 * board, the share picker, the team page, today, settings. Splitting
 * ready_to_post out of `preparing` (2026-09-11, so the รอโพสต์ queue could
 * tell "support's turn" from "sales hasn't finished") meant all eight had to
 * learn the new role at once, and any one of them missed would have dropped
 * those listings out of a count with nothing to show for it. Naming the set
 * makes the next role a one-line change instead of a scavenger hunt.
 */
export const ACTIVE_LISTING_ROLES: OptionRole[] = [
  "posted",
  "ready_to_post",
  "preparing",
];

/** Where a kind's keys are stored — drives rename rewrites + in-use counts.
    Raw table/column names (SQL identifiers), not drizzle objects, so the
    editor action can build UPDATEs generically. */
export interface KindColumn {
  table: string;
  column: string;
  /** Rules keyed BY the value rather than data USING it (sla_rules). Renamed
      like any other column, but never counted as usage — a row's "12 รายการ"
      must stay a count of real data, not of the settings that describe it. */
  config?: true;
  /** Restrict the rename rewrite to part of the table. Needed when one column
      holds several kinds' keys side by side: sla_rules.potential carries both
      listing grades and lead grades, told apart by `entity`. Without the
      scope, renaming a listing grade would rewrite the lead rules too. */
  scope?: { column: string; values: string[] };
  /** Thai noun for this column's rows, set when the column is part of a
      unique index — the rename pre-check uses it to explain a collision
      instead of letting Postgres raise. */
  uniqueNoun?: string;
  /** The REST of that unique index. sla_rules is unique on (entity,
      potential) and `entity` is already the scope, so the list is empty;
      repost_rules is unique on (grade_key, channel_key), so renaming a grade
      only collides on the channels the old and new grade share. Without this
      the pre-check would refuse renames that are perfectly safe. */
  uniqueWith?: string[];
}

/** Settings-page grouping — which cluster of the kind picker a kind sits in. */
export type OptionKindGroup = "listing" | "lead" | "deal" | "other";

export const KIND_GROUPS: { key: OptionKindGroup; title: string }[] = [
  { key: "listing", title: "ประกาศ & ทรัพย์" },
  { key: "lead", title: "ลูกค้า Lead" },
  { key: "deal", title: "ดีล & บัญชี" },
  { key: "other", title: "อื่นๆ" },
];

export interface OptionKindDef {
  kind: string;
  group: OptionKindGroup;
  /** Settings page heading. */
  title: string;
  hint: string;
  /** Roles this kind's editor offers (empty = plain vocabulary). */
  roles: OptionRole[];
  columns: KindColumn[];
  /** Kind-specific extra field the editor renders:
      "section"        — P&L block (ledger_category)
      "linkedCategory" — which ledger_category this row posts to (payout_role)
      "activityScope"  — which record this activity belongs to (action_category) */
  extra?: "section" | "linkedCategory" | "activityScope";
}

export const OPTION_KINDS: OptionKindDef[] = [
  {
    kind: "listing_status",
    group: "listing",
    title: "สถานะประกาศ",
    hint: "สถานะของ Listing — แถวที่ติดเหรียญพฤติกรรมจะถูกนับในแดชบอร์ดและ SLA",
    roles: [
      "posted",
      "ready_to_post",
      "preparing",
      "paused",
      "withdrawn",
      "closed_won",
      "closed_other",
    ],
    columns: [{ table: "listings", column: "status" }],
  },
  {
    kind: "listing_type",
    group: "listing",
    title: "ประเภทการขาย",
    hint: "Sale / Rent / Co-Agent … — ผูกกับเทมเพลตโพสต์",
    roles: [],
    columns: [
      { table: "listings", column: "listing_type" },
      // The post template is keyed by this text (copy_templates is PK'd on
      // (listing_type, tier)). A rename that leaves the template behind drops
      // the client's brand voice back to the shipped default silently — the
      // post still renders, it just stops being theirs. Config, not usage:
      // a template is a setting ABOUT the type, not data using it.
      {
        table: "copy_templates",
        column: "listing_type",
        config: true,
        uniqueNoun: "เทมเพลตโพสต์",
        uniqueWith: ["tier"],
      },
    ],
  },
  {
    kind: "listing_potential",
    group: "listing",
    title: "เกรดประกาศ",
    hint: "A / B / C / Exclusive — ผูกกับกฎ SLA, รอบดันประกาศ และเทียร์เทมเพลตโพสต์",
    roles: ["hot"],
    columns: [
      { table: "listings", column: "potential" },
      { table: "last_matches", column: "potential" },
      // The SLA table keys its rules by grade text; both listing entities
      // read this kind. Renaming a grade must carry its rules along or the
      // inner join in lib/repo/today.ts silently stops flagging that grade.
      {
        table: "sla_rules",
        column: "potential",
        config: true,
        scope: { column: "entity", values: ["listing_follow", "listing_post"] },
        uniqueNoun: "กฎ SLA",
      },
      // Same story for the repost cadence: lib/repo/reposts.ts INNER JOINs
      // repost_rules on the grade text, so a rename that leaves the rules
      // behind quietly empties the ดันประกาศ queue for that grade.
      {
        table: "repost_rules",
        column: "grade_key",
        config: true,
        uniqueNoun: "รอบดันประกาศ",
        uniqueWith: ["channel_key"],
      },
    ],
  },
  {
    kind: "lead_potential",
    group: "lead",
    title: "เกรดลูกค้า",
    hint: "A / B / C / New Lead",
    roles: [],
    columns: [
      { table: "leads", column: "potential" },
      {
        table: "sla_rules",
        column: "potential",
        config: true,
        scope: { column: "entity", values: ["lead_follow"] },
        uniqueNoun: "กฎ SLA",
      },
    ],
  },
  {
    kind: "property_type",
    group: "listing",
    title: "ประเภททรัพย์",
    hint: "บ้านเดี่ยว คอนโด ที่ดิน …",
    roles: [],
    columns: [
      { table: "listings", column: "property_type" },
      { table: "last_matches", column: "property_type" },
    ],
  },
  {
    kind: "direction",
    group: "listing",
    title: "ทิศ",
    hint: "ทิศที่หันหน้า",
    roles: [],
    columns: [
      { table: "listings", column: "direction" },
      { table: "last_matches", column: "direction" },
    ],
  },
  {
    kind: "unit_position",
    group: "listing",
    title: "ตำแหน่งยูนิต",
    hint: "มุม ริม วิวโล่ง …",
    roles: [],
    columns: [{ table: "listings", column: "position" }],
  },
  {
    kind: "price_remark",
    group: "listing",
    title: "เงื่อนไขราคา",
    hint: "ใครออกค่าโอน ภาษีรวมหรือไม่",
    roles: [],
    columns: [{ table: "listings", column: "price_remark" }],
  },
  {
    kind: "unit_condition",
    group: "listing",
    title: "สภาพห้อง",
    hint: "Great / Good / Bad / Broken",
    roles: [],
    columns: [{ table: "listings", column: "unit_condition" }],
  },
  {
    kind: "location_grade",
    group: "listing",
    title: "เกรดทำเล",
    hint: "A / B / C",
    roles: [],
    columns: [{ table: "listings", column: "location_grade" }],
  },
  {
    kind: "listing_channel",
    group: "listing",
    title: "ช่องทางลงประกาศ",
    hint: "เว็บ/เพจที่เอาประกาศไปลง — ใช้ในหน้าการตลาดของ Listing",
    roles: [],
    columns: [
      { table: "listing_channels", column: "channel" },
      // The push log keys its rows by channel text. Nothing reads it back per
      // channel today, but a rename means "we renamed this channel", not "this
      // is a different channel" — leaving the log behind would split any
      // future per-channel KPI in two. It is real data, so it counts as usage.
      { table: "portal_pushes", column: "channel" },
      {
        table: "repost_rules",
        column: "channel_key",
        config: true,
        uniqueNoun: "รอบดันประกาศ",
        uniqueWith: ["grade_key"],
      },
    ],
  },
  {
    kind: "lead_type",
    group: "lead",
    title: "ประเภทลูกค้า",
    hint: "Owner - Sale / Buyer - Buy …",
    roles: [],
    columns: [{ table: "leads", column: "lead_type" }],
  },
  {
    kind: "marketing_channel",
    group: "lead",
    title: "ช่องทางการตลาด",
    hint: "ลูกค้าเจอเราจากที่ไหน — คนละเรื่องกับช่องทางลงประกาศ",
    roles: [],
    columns: [{ table: "leads", column: "source" }],
  },
  {
    kind: "contact_by",
    group: "lead",
    title: "ช่องทางติดต่อ",
    hint: "ลูกค้าทักเข้ามาทางไหน",
    roles: [],
    columns: [{ table: "leads", column: "contact_by" }],
  },
  {
    kind: "lead_status",
    group: "lead",
    title: "สถานะลูกค้า",
    hint: "Active คือลูกค้าที่กำลังตามอยู่ — แถวที่ติดเหรียญจะถูกนับในแดชบอร์ด",
    roles: ["open", "won", "lost"],
    columns: [{ table: "leads", column: "lead_status" }],
  },
  {
    kind: "case_status",
    group: "lead",
    title: "สถานะเคส",
    hint: "ผลของเคสตอนปิด",
    roles: [],
    columns: [{ table: "leads", column: "case_status" }],
  },
  {
    kind: "complain_severity",
    group: "lead",
    title: "ระดับข้อร้องเรียน",
    hint: "Small / Serious / Critical",
    roles: [],
    columns: [{ table: "leads", column: "complain_severity" }],
  },
  {
    kind: "complain_status",
    group: "lead",
    title: "สถานะข้อร้องเรียน",
    hint: "กำลังแก้ / แก้แล้ว / แก้ไม่ได้",
    roles: [],
    columns: [{ table: "leads", column: "complain_status" }],
  },
  {
    kind: "closing_status",
    group: "deal",
    title: "สถานะการเงินของดีล",
    hint: "‘ได้รับคอมมิชชั่นแล้ว’ คือเหรียญที่ทำให้ดีลออกจากยอดค้างรับ",
    roles: ["settled", "dead"],
    columns: [{ table: "deals", column: "closing_status" }],
  },
  {
    kind: "last_match_type",
    group: "other",
    title: "ประเภท Last Match",
    hint: "ใครเป็นคนปิดยูนิตนั้น",
    roles: [],
    columns: [{ table: "last_matches", column: "type" }],
  },
  {
    kind: "action_category",
    group: "other",
    title: "ประเภทกิจกรรม",
    hint: "งานที่ลงบันทึกในประวัติของทรัพย์ / ลูกค้า และในแผนประจำวัน",
    roles: [],
    // Which timeline offers this kind. The composer on a listing shows only
    // ทรัพย์ rows and the one on a lead only ลูกค้า rows, so a mis-filed
    // Owner Visit on a buyer is impossible rather than merely discouraged.
    extra: "activityScope",
    columns: [{ table: "actions", column: "category" }],
  },
  {
    kind: "task_type",
    group: "other",
    title: "ประเภทงานในแผน",
    hint: "หมวดของงานในแผนประจำวัน — ใช้ระบายสีและสัดส่วนงานเท่านั้น",
    roles: [],
    columns: [
      { table: "daily_plan_tasks", column: "kind" },
      { table: "plan_recurring", column: "kind" },
    ],
  },
  {
    kind: "payout_role",
    group: "deal",
    title: "บทบาทส่วนแบ่งคอม",
    hint: "ใครมีสิทธิ์รับส่วนแบ่งจากดีล — เลือกได้ว่าลง P&L บรรทัดไหน",
    roles: [],
    extra: "linkedCategory",
    columns: [
      { table: "deal_payouts", column: "role" },
      { table: "transactions", column: "payout_role" },
    ],
  },
  {
    kind: "ledger_category",
    group: "deal",
    title: "หมวดบัญชี",
    hint: "ผังบัญชีของสมุดบัญชี — แต่ละหมวดผูกกับบล็อกใน P&L",
    roles: ["commission_income", "commission_split"],
    extra: "section",
    columns: [{ table: "transactions", column: "category" }],
  },
  {
    kind: "employment_status",
    group: "other",
    title: "สถานะพนักงาน",
    hint: "ทำงานอยู่ / ทดลองงาน / ลาออก — ตั้งเป็นแถวที่ติดเหรียญ ‘ออกแล้ว’ แล้วระบบจะระงับบัญชีให้ทันที",
    roles: ["departed"],
    columns: [{ table: "users", column: "employment_status" }],
  },
  {
    kind: "trust_trigger",
    group: "other",
    title: "Trust Trigger",
    hint: "เหตุผลที่ลูกค้าเชื่อถือ (ใช้ใน Persona ของโครงการ)",
    roles: [],
    columns: [{ table: "project_personas", column: "trust_trigger" }],
  },
];

export const OPTION_KIND_KEYS = OPTION_KINDS.map((k) => k.kind);

export function kindDef(kind: string): OptionKindDef | undefined {
  return OPTION_KINDS.find((k) => k.kind === kind);
}
