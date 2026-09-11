// Role-permission TYPES + the seed matrix (DATA_MODEL §5). Since 2026-08-23
// the live matrix is DATA — the `roles` table, editable at /settings/roles —
// and reads go through lib/repo/roles.ts permsFor(). This file keeps the
// typed shape, the seed values, and the validator that keeps a malformed DB
// row from ever granting more than the shipped defaults. Scoping itself is
// still enforced in the query layer (lib/repo/scope.ts); there is no RLS.

/* FIVE ROLES SINCE 2026-08-29 (Ben: "the current admin is actually superadmin
   role", "there should be 2 support role — admin support (รับลูกค้า), listing
   support (ดูแลฝั่งทรัพย์)").

   `admin` was doing two unrelated jobs: running the system, and being the desk
   that takes enquiries off the platforms and hands them to sales. In a Thai
   office those are not the same person and "แอดมิน" means the second one — so
   the system job is now `superadmin` and the desk is `admin_support`, sitting
   beside `listing_support` (renamed from `support`, which said nothing once
   there were two of them). intakeAssign moved with the job. */
export const ROLES = [
  "superadmin",
  "manager",
  // บัญชี since 2026-09-11 (Ben: "add role บัญชี -> มีหน้ารวมเคสที่ปิด +
  // recheck ความถูกต้อง"). The sixth seat, and the first one that is neither
  // sales nor system: it owns the money AFTER a deal closes — the commission
  // that arrived, the splits paid out of it, and the books those land in.
  //
  // Ordered here, not at the end, because the roles table's order is also the
  // ORG ORDER the settings list reads in, and it decides a multi-role user's
  // default dashboard seat (lib/auth/position.ts). บัญชี is an oversight desk,
  // not a support desk; it belongs beside ผู้จัดการ rather than after
  // ซัพพอร์ตประกาศ.
  "accounting",
  "sales",
  "admin_support",
  "listing_support",
] as const;
export type Role = (typeof ROLES)[number];

/** How much of an entity collection a role can see. */
export type Scope =
  | "none"
  | "own" // rows they created / are assigned to
  | "own+zone" // own rows plus rows in their assigned zones
  | "all";

export interface RolePermissions {
  listings: Scope;
  leads: Scope;
  deals: Scope;
  /** Buyer/seller legal identity on deals (fullname, address, ID no.). */
  dealLegalPII: boolean;
  /**
   * Contact details in the person book (`contacts`, which absorbed `owners`
   * in 0015): everyone, or only people tied to the viewer's own work — the
   * owner of one of their listings, or the contact on one of their leads.
   * The key kept its name: on a LISTING it still gates exactly the owner's
   * details, which is what canSeeOwnerOn() decides.
   */
  ownerContacts: "all" | "own-listings";
  /**
   * Browse the company-wide listing inventory (/inventory) — every listing
   * regardless of `listings` scope, READ-ONLY and with owner contact still
   * governed by `ownerContacts`. Deliberately separate from `listings` so
   * widening who can *see* the stock never widens who can *edit* it: the
   * write path stays on listingScope() alone.
   */
  listingDirectory: boolean;
  /**
   * Browse every lead in the company (/lead-directory) — the Lead twin of
   * `listingDirectory` above, and read-only for the same reason (Ben,
   * 2026-08-29).
   *
   * IT EXISTS BECAUSE /leads STOPPED BEING ONE. That page is a work surface —
   * your own book, capped at own+zone for everybody (lib/repo/scope.ts
   * ownBook) — so the wide read had to go somewhere, exactly as ทรัพย์ /
   * ทรัพย์ทั้งบริษัท already split it for listings.
   *
   * ผู้จัดการ and แอดมินซัพพอร์ต only: one reads the team's pipeline, the other
   * works it. ซัพพอร์ตประกาศ handles property, not customers, and a sales
   * agent reading every other agent's buyers is the thing zone scoping exists
   * to prevent.
   */
  leadDirectory: boolean;
  /** Access the /listing-updates change-request queue. */
  listingUpdateQueue: boolean;
  /** Goal visibility: own targets only, or the whole team's board. */
  goals: "own" | "all";
  /**
   * Last Match visibility: the records you entered, or the whole company's
   * (Ben, 2026-09-11: "ให้แค่ทีม leader เห็น", leader = ผู้จัดการ).
   *
   * IT WAS NOT A PERMISSION AT ALL until now. The page carried own/ทีม/ทั้งหมด
   * buttons that any logged-in person could click, and lastmatch.ts said so in
   * as many words — "applied on top of nothing else: the log is meant to be
   * shared intel". Closed prices and buyer personas across the whole company
   * are the most portable thing in this database, and every agent had them.
   *
   * "own" RATHER THAN false, because sales still ENTER these (24 of the first
   * 40 rows are theirs). A role that can write into a list it can never read
   * back is a role that stops writing, and the intel dries up at the source.
   *
   * THE SAME SHAPE AS `goals` ABOVE, deliberately: two settings, edited by the
   * same kind of select in the roles editor, and neither is a scope in the
   * listings/leads sense — there is no zone reading of a closed deal.
   */
  lastMatch: "own" | "all";
  /** Assign incoming leads to agents. */
  intakeAssign: boolean;
  /**
   * Run a sales team: claim which agents report to you, and set their revenue
   * and KPI targets (Ben, 2026-08-29).
   *
   * ONE FLAG FOR BOTH, because they are one duty — the manager who sets your
   * targets is the manager you report to, and a role that could do one
   * without the other would be a job nobody holds.
   *
   * A SEPARATE FLAG FROM `goals`, which only decides whose เป้าหมาย you can
   * SEE. Reading the whole team's board and deciding what the team is
   * measured on are different acts, and the people who do them are not the
   * same set: admin sees everything and sets nobody's numbers.
   *
   * Manager's job; ซูเปอร์แอดมิน holds it too as break-glass (Ben,
   * 2026-09-11) — see the note on the superadmin row. A sales agent does not
   * set their own targets: they see them and are scored against them, which is
   * what makes them targets rather than a self-assessment.
   *
   * DOES NOT IMPLY teamManage. Claiming a report is not the same as editing
   * an HR record: /team/[id]/edit carries ID card number, address, emergency
   * contacts and agreement files, and none of that is a manager's business.
   */
  targetsSet: boolean;
  /** Master data, SLA rules, roles, LINE groups. */
  settings: boolean;
  /** Manage team records (HR fields, zone assignment). */
  teamManage: boolean;
  /** Approve leave requests. */
  leaveApprove: boolean;
  /** Cash ledger + P&L (/ledger). */
  ledger: boolean;
  /**
   * Read the access log — who has been opening the โครงการ surveys and Last
   * Match, and how much (Ben, 2026-09-11).
   *
   * ITS OWN FLAG BECAUSE NO EXISTING ONE FITS. The two people who investigate
   * "is somebody copying our market research" are ซูเปอร์แอดมิน and ผู้จัดการ,
   * and those two share no oversight permission today — settings, teamManage
   * and ledger are all superadmin-only, and focusDirectory is about coaching,
   * not security. Reusing one of them would have meant either locking the
   * manager out of the report or handing them the HR records to get in.
   *
   * READING THE LOG IS ITSELF SENSITIVE. It says where every colleague spends
   * their attention, which is a thing to hand out on purpose rather than as a
   * side effect of holding some other permission.
   */
  viewAudit: boolean;
  /** Sign off / reopen closed deals (the review lock). */
  dealReview: boolean;
  /** AI paste-to-form — its own switch because every parse spends budget. */
  aiParse: boolean;

  /** MAY OPEN A NEW LEAD (Ben, 2026-09-11: "sales should never be able to
      create leads").

      Separate from `leads`, which is a VISIBILITY scope. Sales must keep
      `leads: "own+zone"` to work the book they are handed, and conflating the
      two meant "can see my leads" silently also meant "can invent one" —
      canCreate() read the scope and nothing else.

      Intake is one desk: enquiries arrive on the company's channels, admin
      support turns them into rows and assigns them out. A lead typed by the
      agent who will own it skips the dedupe check that desk performs, and
      skips being counted as an enquiry at all. */
  leadCreate: boolean;

  /**
   * May browse ANOTHER agent's โฟกัสเจ้าของ list (/owner-focus).
   *
   * Everybody keeps their own — the star is a personal working set, not a
   * grant — so this flag is only ever about reading someone else's. Ben,
   * 2026-09-11: managers see it, because "you have 120 starred" is a coaching
   * conversation and it cannot happen if the number is invisible.
   *
   * A BROWSE FLAG, in the family of listingDirectory / leadDirectory rather
   * than a scope: there is no middle setting. You read the team's focus or
   * you read your own, and the underlying listings were already visible to
   * whoever holds this — it exposes the CHOICE, not new rows.
   */
  focusDirectory: boolean;
}

export const ROLE_MATRIX: Record<Role, RolePermissions> = {
  superadmin: {
    listings: "all",
    leads: "all",
    deals: "all",
    dealLegalPII: true,
    ownerContacts: "all",
    listingDirectory: true,
    // NOT superadmin's, by the same rule as the two flags below (Ben,
    // 2026-08-29: "only show this page for manager and admin support role").
    // The data is not hidden — `leads: "all"` above is untouched, and every
    // lead is reachable from its own page. What is withheld is a browsing
    // surface built for two jobs superadmin does not do. To browse it, hold
    // แอดมินซัพพอร์ต as a second role — this row is locked, so that is the
    // escape hatch, not the settings editor.
    leadDirectory: false,
    // NOT admin's, despite admin holding everything else (Ben, 2026-08-29).
    // The 2026-08-25 split (07ba3d9) separated the two admin-side desks —
    // แอดมิน takes enquiries off the platforms and assigns them, ซัพพอร์ตประกาศ
    // posts listings to the portals — but only corrected the over-grant going
    // the other way (support.intakeAssign). This is the mirror case, and it
    // had never been decided: `true` here was inherited from the original
    // seed's blanket "admin gets everything", not chosen.
    //
    // A QUEUE WITH TWO OWNERS HAS NONE. คิวแก้ไขทรัพย์ is a worklist, and the
    // failure mode of an unowned worklist is silence — the exact thing the SLA
    // cards exist to catch.
    //
    // BREAK-GLASS IS HOLDING THE OTHER ROLE, not editing this row. Superadmin's
    // matrix is locked against editing (settings/roles/actions.ts) precisely so
    // it can never be locked out of the app, which also means it cannot grant
    // itself a flag. When both support staff are away, superadmin takes the
    // ซัพพอร์ตประกาศ role as a second position — which is what the multi-role
    // system is for. (Corrected 2026-08-29: the note here used to claim
    // /settings/roles as the escape hatch, and the lock had always refused it.)
    listingUpdateQueue: false,
    goals: "all",
    lastMatch: "all",
    // MOVED TO admin_support (Ben, 2026-08-29). Taking enquiries off the
    // platforms and handing them to sales is a JOB — a desk somebody sits at
    // every day — and it was only ever here because the same person happened
    // to hold the system password. Splitting the role split the duty with it.
    // Same rule as listingUpdateQueue above: a queue with two owners has none,
    // and holding แอดมินซัพพอร์ต is the break-glass when the desk is empty.
    intakeAssign: false,
    // TRUE SINCE 2026-09-11, reversing the 2026-08-29 decision recorded here
    // ("Superadmin sees every goal and sets no one's numbers. Deciding what the
    // sales team is measured on is the manager's job"). That reasoning was
    // right about the JOB and wrong about the lock.
    //
    // WHAT CHANGED IS EVIDENCE, NOT OPINION. Production spent three weeks with
    // targetsSet missing from every role row, so nobody in the company could
    // set a target — and it could not be fixed from inside the app, because
    // the one role that can always reach Settings had been excluded from the
    // permission on principle. Every other "a job with two owners has none"
    // exclusion on this row has holding the other role as its break-glass
    // (see listingUpdateQueue and intakeAssign above); this one had none,
    // because the fallback role was broken by the same gap.
    //
    // Day to day this changes nothing: the manager still owns the team's
    // numbers, and superadmin is not who sets them. It means the person who
    // administers the system cannot be locked out of unsticking it.
    targetsSet: true,
    settings: true,
    teamManage: true,
    leaveApprove: true,
    ledger: true,
    viewAudit: true,
    dealReview: true,
    leadCreate: true,
    focusDirectory: true,
    aiParse: true,
  },
  manager: {
    listings: "all",
    leads: "all",
    deals: "all",
    dealLegalPII: false,
    ownerContacts: "all",
    listingDirectory: true,
    // The team's pipeline, now that /leads is each person's own book.
    leadDirectory: true,
    // Portal work belongs to ซัพพอร์ตประกาศ (Ben, 2026-08-29). This one flag
    // gates three surfaces — /listing-updates, /reposts and the โพสต์เก่า card
    // on the daily plan — and none of them is a manager's: they are the
    // execution queue for mirroring the CRM onto the portals, not an approval
    // hierarchy. Same correction as intakeAssign below.
    listingUpdateQueue: false,
    goals: "all",
    lastMatch: "all",
    // Handing out enquiries is ADMIN's job, not the manager's (Ben,
    // 2026-08-28) — the same correction already recorded on `support` below.
    // A manager reads the team; admin runs the intake desk. This is what kept
    // รอจ่ายงาน and การกระจายงาน on the manager dashboard after it was
    // rebuilt as a pure team report: the cards were gated correctly, the
    // permission was wrong.
    intakeAssign: false,
    // The manager owns the sales team's numbers — this is the only role that
    // does. Any manager may set any agent's (Ben, 2026-08-29): with two
    // managers and five agents, scoping it to direct reports would strand a
    // target the moment someone changed hands mid-quarter.
    targetsSet: true,
    settings: false,
    teamManage: false,
    leaveApprove: true,
    ledger: false,
    viewAudit: true,
    // FALSE SINCE 2026-09-11, when บัญชี arrived (Ben: "บัญชีเป็นเจ้าของ
    // ผู้จัดการดูอย่างเดียว").
    //
    // THE SAME RULE ALREADY WRITTEN ON THIS ROW TWICE — a queue with two
    // owners has none. It is why listingUpdateQueue and intakeAssign are false
    // here, and the evidence for applying it again is unusually direct: the
    // sign-off has existed since the deal module shipped, ซูเปอร์แอดมิน and
    // ผู้จัดการ have both held it the whole time, and production has 39 closed
    // deals of which 0 were ever signed off. Shared ownership did not produce
    // a slow reviewer; it produced no reviewer.
    //
    // A manager still READS every deal (deals: "all" above) and still gets the
    // "มีดีลรอตรวจ" notification's subject matter through the ดีลปิด tab. What
    // moves is the act of locking the numbers, which is a bookkeeper's act:
    // "ตรวจแล้ว" is a claim that the commission, the splits and the dates match
    // the bank, and the manager does not hold the bank statement.
    //
    // ซูเปอร์แอดมิน keeps it as break-glass — the standing pattern on that row
    // for every duty it does not own, and this time deliberately, after 0034
    // showed what an exclusion with no break-glass costs.
    dealReview: false,
    leadCreate: true,
    // The manager's read on how the team is spending its attention.
    focusDirectory: true,
    aiParse: true,
  },
  /* บัญชี — the desk that owns the money after a deal closes (Ben,
     2026-09-11). Its job is one sentence: make the books match the bank.

     WIDE ON MONEY, BLIND TO THE BOOK. Every deal, every commission, every
     split, the ledger, and the buyer/seller legal identity — and no listings,
     no leads, no team, no settings. That is the exact inverse of
     แอดมินซัพพอร์ต, which is wide on people and narrow on money, and the two
     rows should be read together: between them they cover the whole company
     without either holding both halves of a transaction.

     listings AND leads ARE "none", not "all". An accountant verifying a
     commission needs the DEAL — price, cut, dates, who sold it — all of which
     lives on the deal row and is left-joined onto it unscoped (getDeal). They
     never need to edit a listing, and in this codebase `listings: "all"` IS
     the write grant: the read scope and the write gate are the same
     listingScope() call, so widening the read to make one link clickable would
     hand the bookkeeper edit rights on all 1,649 listings. The link is the
     smaller loss.

     dealLegalPII IS TRUE, and it is the one genuinely uncomfortable grant here
     (Ben, 2026-09-11: "เห็น"). Issuing an invoice and filing withholding tax
     needs the buyer's legal name, address and ID number; there is no version
     of accounting that works without it. It was ซูเปอร์แอดมิน-only until now,
     so this widens the most sensitive column set in the database from one role
     to two — on purpose, named here rather than arriving as a side effect of
     some broader flag.

     aiParse IS FALSE. Not a judgement — there is simply no paste-to-form on
     any surface this role can reach, and a switch that spends budget should
     not be on for a seat that cannot press it. */
  accounting: {
    // See the header: "none" is the WRITE gate as much as the read scope.
    listings: "none",
    leads: "none",
    deals: "all",
    dealLegalPII: true,
    // Moot while listings is "none" (canSeeOwnerOn needs a listing they own),
    // and set restrictively on purpose so it stays moot if that ever changes:
    // an owner's phone number is not a bookkeeping input.
    ownerContacts: "own-listings",
    // canBrowseDirectory() also requires listings !== "none", so this could
    // not open /inventory even if it were true. Stated as false so the row
    // says what it means rather than relying on a second check to cancel it.
    listingDirectory: false,
    leadDirectory: false,
    listingUpdateQueue: false,
    goals: "own",
    lastMatch: "own",
    intakeAssign: false,
    targetsSet: false,
    settings: false,
    teamManage: false,
    leaveApprove: false,
    // The books themselves — /ledger, the accounts, the P&L.
    ledger: true,
    viewAudit: false,
    // The duty this role exists for, moved off ผู้จัดการ — see that row.
    dealReview: true,
    leadCreate: false,
    focusDirectory: false,
    aiParse: false,
  },
  sales: {
    listings: "own+zone",
    leads: "own+zone",
    deals: "own",
    dealLegalPII: false,
    ownerContacts: "own-listings",
    // Stock is shared and buyers are not. Finding another agent's listing is
    // how a co-broke starts; reading another agent's buyers is what zone
    // scoping exists to prevent.
    listingDirectory: true,
    leadDirectory: false,
    listingUpdateQueue: false,
    goals: "own",
    lastMatch: "own",
    intakeAssign: false,
    targetsSet: false,
    settings: false,
    teamManage: false,
    leaveApprove: false,
    ledger: false,
    viewAudit: false,
    dealReview: false,
    // The intake desk's job, not the agent's — see leadCreate.
    leadCreate: false,
    // Your own focus list is yours; nobody else's is your business.
    focusDirectory: false,
    aiParse: true,
  },
  listing_support: {
    listings: "all",
    leads: "all", // read-only by intent: see enquiries, never assign them
    deals: "none",
    dealLegalPII: false,
    ownerContacts: "all",
    listingDirectory: true,
    // ดูแลฝั่งทรัพย์ — property, not customers (Ben, 2026-08-29). `leads` stays
    // "all" because seeing an enquiry is how they know a listing is live, and
    // narrowing it would break the detail pages they reach from the portal
    // queue. Withholding the browse surface is the honest half of that.
    leadDirectory: false,
    listingUpdateQueue: true,
    goals: "own",
    lastMatch: "own",
    // Lead intake and (re)assignment belong to ADMIN (Ben, 2026-08-25).
    // Listing support posts listings to the portals; they do not hand out
    // buyers. This is the one bit the seed had wrong.
    intakeAssign: false,
    targetsSet: false,
    settings: false,
    teamManage: false,
    leaveApprove: false,
    ledger: false,
    viewAudit: false,
    dealReview: false,
    // Portal work, not intake.
    leadCreate: false,
    focusDirectory: false,
    aiParse: true,
  },
  /* แอดมินซัพพอร์ต — รับลูกค้า (Ben, 2026-08-29). The desk that answers the
     platforms: an enquiry lands, they file it and hand it to an agent.

     WIDE ON PEOPLE, NARROW ON MONEY. They need every lead (you cannot assign
     what you cannot see) and every listing (a caller asks about a unit that is
     not yours to answer for), and they need none of the deals, the commission
     or the legal identities — that is the sales side of the same customer, and
     their job ends when the agent picks up.

     They do NOT get listingUpdateQueue. That is the other desk, and this whole
     split exists because one role was doing two jobs. */
  admin_support: {
    listings: "all",
    leads: "all",
    deals: "none",
    dealLegalPII: false,
    ownerContacts: "all",
    listingDirectory: true,
    leadDirectory: true,
    listingUpdateQueue: false,
    goals: "own",
    lastMatch: "own",
    // The duty this role exists for — moved off superadmin.
    intakeAssign: true,
    targetsSet: false,
    settings: false,
    teamManage: false,
    leaveApprove: false,
    ledger: false,
    viewAudit: false,
    dealReview: false,
    // Enquiries arrive as pasted LINE and Facebook messages; turning one into
    // a lead row IS the job.
    leadCreate: true,
    focusDirectory: false,
    aiParse: true,
  },
};

/** The boolean permission fields — the settings editor's toggle set and
    the master list's "สิทธิ์ M/N" summary both derive from this list. */
export const PERM_TOGGLE_KEYS = [
  "listingDirectory",
  "leadDirectory",
  "dealLegalPII",
  "listingUpdateQueue",
  "intakeAssign",
  "leadCreate",
  "focusDirectory",
  "targetsSet",
  "settings",
  "teamManage",
  "leaveApprove",
  "ledger",
  "viewAudit",
  "dealReview",
  "aiParse",
] as const satisfies readonly (keyof RolePermissions)[];

export function grantCount(p: RolePermissions): number {
  return PERM_TOGGLE_KEYS.filter((k) => p[k]).length;
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** STATIC fallback — seed values only. Server code wanting the live,
    client-edited matrix must use lib/repo/roles.ts permsFor(); this stays
    for client components doing display-only gating (Sidebar) and as the
    fallback when a role row is missing. */
export function permissionsFor(role: string): RolePermissions {
  return ROLE_MATRIX[isRole(role) ? role : "sales"];
}

/** Thai names/descriptions for the seed roles (roles-table seed data). */
export const SEED_ROLE_META: Record<
  Role,
  { name: string; description: string }
> = {
  superadmin: {
    name: "ซูเปอร์แอดมิน",
    description:
      "ดูแลระบบทั้งหมด — ตั้งค่า สิทธิ์การใช้งาน บัญชีผู้ใช้ และข้อมูล PII · ไม่ได้รับ Lead · ตั้งเป้าและตรวจดีลได้ในฐานะสำรองเมื่อผู้จัดการหรือบัญชีไม่อยู่",
  },
  manager: { name: "ผู้จัดการ", description: "เห็นทุกดีลและลูกค้า ตั้งเป้าและดูแลทีมเซลส์ อนุมัติลาได้ แต่ไม่แตะการตั้งค่าระบบ" },
  accounting: {
    name: "บัญชี",
    description:
      "ดูแลเงินหลังปิดดีล — ตรวจคอมมิชชัน ส่วนแบ่ง และวันรับเงิน แล้วล็อกตัวเลข · คุมสมุดบัญชีทุกบัญชีและงบกำไรขาดทุน · ไม่แตะทรัพย์ Lead หรือการตั้งค่า",
  },
  sales: { name: "เซลส์", description: "เห็นงานของตัวเองและโซนที่ได้รับมอบหมาย" },
  admin_support: {
    name: "แอดมินซัพพอร์ต",
    description:
      "รับลูกค้า — รับ Lead จากทุกช่องทาง ลงข้อมูล แล้วมอบหมายให้เซลส์ · เห็น Lead และทรัพย์ทั้งบริษัท ไม่เห็นดีลและค่าคอม",
  },
  listing_support: {
    name: "ซัพพอร์ตประกาศ",
    description:
      "ดูแลฝั่งทรัพย์ — โพสต์ประกาศให้เซลส์บนทุกแพลตฟอร์ม ดูแลคิวแก้ไขทรัพย์และดันประกาศ · ไม่มอบหมาย Lead ไม่เห็นดีล",
  },
};

/**
 * Merge several roles into one effective matrix — MOST PERMISSIVE wins on
 * every field (Ben, 2026-08-25: an employee can be sales AND manager at once).
 *
 * Off the request path since 2026-08-28 — see permsForUser() in
 * lib/repo/roles.ts for why a viewer no longer holds several roles at once.
 *
 * Roles are additive, so this is the only coherent rule: holding a second role
 * can never take something away. It also means the merge is order-independent,
 * which matters because nothing guarantees the order rows come back in.
 *
 * An EMPTY list is not "no permissions" — it is a bug upstream (a user with no
 * role rows). It degrades to the sales matrix, matching permissionsFor()'s
 * treatment of an unknown id: restrictive, but never locked out.
 */
export function mergePerms(list: RolePermissions[]): RolePermissions {
  if (list.length === 0) return ROLE_MATRIX.sales;
  if (list.length === 1) return list[0];

  const widest = <T extends string>(order: readonly T[], vals: T[]): T =>
    vals.reduce((a, b) => (order.indexOf(b) > order.indexOf(a) ? b : a));
  const anyTrue = (k: keyof RolePermissions) => list.some((p) => Boolean(p[k]));

  return {
    listings: widest(SCOPES, list.map((p) => p.listings)),
    leads: widest(SCOPES, list.map((p) => p.leads)),
    deals: widest(SCOPES, list.map((p) => p.deals)),
    dealLegalPII: anyTrue("dealLegalPII"),
    ownerContacts: list.some((p) => p.ownerContacts === "all")
      ? "all"
      : "own-listings",
    listingDirectory: anyTrue("listingDirectory"),
    leadDirectory: anyTrue("leadDirectory"),
    listingUpdateQueue: anyTrue("listingUpdateQueue"),
    goals: list.some((p) => p.goals === "all") ? "all" : "own",
    lastMatch: list.some((p) => p.lastMatch === "all") ? "all" : "own",
    intakeAssign: anyTrue("intakeAssign"),
    leadCreate: anyTrue("leadCreate"),
    focusDirectory: anyTrue("focusDirectory"),
    targetsSet: anyTrue("targetsSet"),
    settings: anyTrue("settings"),
    teamManage: anyTrue("teamManage"),
    leaveApprove: anyTrue("leaveApprove"),
    ledger: anyTrue("ledger"),
    viewAudit: anyTrue("viewAudit"),
    dealReview: anyTrue("dealReview"),
    aiParse: anyTrue("aiParse"),
  };
}

const SCOPES: readonly Scope[] = ["none", "own", "own+zone", "all"];

/** Validate a jsonb perms blob field-by-field; anything malformed falls back
    to the SALES value for that field — degrade restrictive, never permissive. */
/**
 * Validate a PARTIAL permission patch, keeping ONLY the keys it actually
 * carries and only when their value is well-formed.
 *
 * THE DIFFERENCE FROM parsePerms MATTERS, and it is the whole point. parsePerms
 * returns a COMPLETE matrix, filling every key it was not given with the sales
 * default. That is right when reading a stored row — a missing field should
 * degrade restrictive — and catastrophic when writing one toggle: it turns
 * "set ledger true" into "write all nineteen fields", so two toggles saved at
 * the same time each overwrite the other's field with the value it had before
 * either started. One of the two clicks is then silently lost.
 *
 * This keeps a patch a patch, so the UPDATE can merge it into the stored jsonb
 * server-side and touch nothing else.
 *
 * An unknown key or a wrong-typed value is DROPPED rather than defaulted:
 * dropping writes nothing, while defaulting would quietly rewrite a field the
 * caller never mentioned — the same bug in a smaller coat.
 */
export function sanitizePermPatch(patch: unknown): Partial<RolePermissions> {
  if (typeof patch !== "object" || patch === null) return {};
  const v = patch as Record<string, unknown>;
  const out: Partial<RolePermissions> = {};

  for (const key of ["listings", "leads", "deals"] as const) {
    if (key in v && SCOPES.includes(v[key] as Scope)) out[key] = v[key] as Scope;
  }
  if ("ownerContacts" in v && (v.ownerContacts === "all" || v.ownerContacts === "own-listings")) {
    out.ownerContacts = v.ownerContacts;
  }
  if ("goals" in v && (v.goals === "all" || v.goals === "own")) {
    out.goals = v.goals;
  }
  if ("lastMatch" in v && (v.lastMatch === "all" || v.lastMatch === "own")) {
    out.lastMatch = v.lastMatch;
  }
  for (const key of PERM_TOGGLE_KEYS) {
    if (key in v && typeof v[key] === "boolean") out[key] = v[key] as boolean;
  }
  return out;
}

export function parsePerms(value: unknown): RolePermissions {
  const base = ROLE_MATRIX.sales;
  if (typeof value !== "object" || value === null) return base;
  const v = value as Record<string, unknown>;
  const scope = (x: unknown, fb: Scope): Scope =>
    SCOPES.includes(x as Scope) ? (x as Scope) : fb;
  const b = (x: unknown, fb: boolean): boolean =>
    typeof x === "boolean" ? x : fb;
  return {
    listings: scope(v.listings, base.listings),
    leads: scope(v.leads, base.leads),
    deals: scope(v.deals, base.deals),
    dealLegalPII: b(v.dealLegalPII, base.dealLegalPII),
    ownerContacts:
      v.ownerContacts === "all" || v.ownerContacts === "own-listings"
        ? v.ownerContacts
        : base.ownerContacts,
    listingDirectory: b(v.listingDirectory, base.listingDirectory),
    leadDirectory: b(v.leadDirectory, base.leadDirectory),
    listingUpdateQueue: b(v.listingUpdateQueue, base.listingUpdateQueue),
    goals: v.goals === "all" || v.goals === "own" ? v.goals : base.goals,
    lastMatch:
      v.lastMatch === "all" || v.lastMatch === "own"
        ? v.lastMatch
        : base.lastMatch,
    intakeAssign: b(v.intakeAssign, base.intakeAssign),
    leadCreate: b(v.leadCreate, base.leadCreate),
    focusDirectory: b(v.focusDirectory, base.focusDirectory),
    targetsSet: b(v.targetsSet, base.targetsSet),
    settings: b(v.settings, base.settings),
    teamManage: b(v.teamManage, base.teamManage),
    leaveApprove: b(v.leaveApprove, base.leaveApprove),
    ledger: b(v.ledger, base.ledger),
    viewAudit: b(v.viewAudit, base.viewAudit),
    dealReview: b(v.dealReview, base.dealReview),
    aiParse: b(v.aiParse, base.aiParse),
  };
}
