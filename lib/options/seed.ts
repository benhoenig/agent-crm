import type { OptionRole } from "./kinds";

/* The initial options catalog — the pg enum values (verbatim sheet vocabulary,
   DATA_MODEL §2) at the moment of the enum → options conversion, plus the
   tones that lived in lib/labels.ts and the behavior roles that replaced
   code's literal-value predicates. Used by the conversion migration and by
   scripts/seed.ts; after that the DB owns the list. */

export interface SeedOption {
  key: string;
  tone?: string;
  role?: OptionRole;
  /** Role is load-bearing for a predicate — row cannot be archived. */
  system?: boolean;
  /** ledger_category: P&L block (lib/ledger.ts LedgerSection). */
  section?: string;
  /** payout_role: the ledger_category key its paid legs post to. */
  linkedKey?: string;
}

export const OPTIONS_SEED: Record<string, SeedOption[]> = {
  // Post-0011 vocabulary: the sheet's "✅" twins (portal-sync done) are
  // retired — that handoff lives in listing_updates now (pending → applied),
  // so each real-world state keeps exactly one key.
  listing_status: [
    { key: "โพสต์แล้ว", tone: "good", role: "posted", system: true },
    { key: "ข้อมูลครบ รอโพสต์", tone: "info", role: "ready_to_post", system: true },
    { key: "ข้อมูลยังไม่ครบ", tone: "warn", role: "preparing", system: true },
    { key: "Update ข้อมูล", tone: "warn", role: "preparing" },
    { key: "เอาประกาศลงชั่วคราว", tone: "muted", role: "paused" },
    { key: "แคนเซิลประกาศ", tone: "bad", role: "withdrawn" },
    { key: "เช่าแล้ว", tone: "accent", role: "closed_won", system: true },
    { key: "ขายแล้ว", tone: "accent", role: "closed_won", system: true },
    { key: "Reserved", tone: "info" },
    { key: "เช่าแล้วเอเจ้นอื่น", tone: "muted", role: "closed_other" },
    { key: "ขายแล้วเอเจ้นอื่น", tone: "muted", role: "closed_other" },
  ],
  listing_type: [
    { key: "Sale" },
    { key: "Rent" },
    { key: "Sale & Rent" },
    { key: "Sale with Tenant" },
    { key: "Co-Agent" },
  ],
  listing_potential: [
    { key: "A", tone: "accent", role: "hot" },
    { key: "B", tone: "info" },
    { key: "C", tone: "muted" },
    { key: "Exclusive", tone: "good", role: "hot" },
  ],
  lead_potential: [
    { key: "A", tone: "accent" },
    { key: "B", tone: "info" },
    { key: "C", tone: "muted" },
    { key: "New Lead", tone: "warn" },
  ],
  property_type: [
    { key: "บ้านเดี่ยว" },
    { key: "บ้านแฝด" },
    { key: "ทาวน์เฮ้าส์" },
    { key: "ทาวน์โฮม" },
    { key: "คอนโด" },
    { key: "ที่ดิน" },
    { key: "อพาร์ทเม้นท์" },
    { key: "โรงแรม" },
    { key: "ออฟฟิศ" },
    { key: "โกดัง" },
    { key: "โรงงาน" },
    { key: "อาคารพาณิชย์" },
  ],
  direction: [
    { key: "North" },
    { key: "South" },
    { key: "East" },
    { key: "West" },
    { key: "Northeast" },
    { key: "Northwest" },
    { key: "Southeast" },
    { key: "Southwest" },
  ],
  unit_position: [
    { key: "มุม" },
    { key: "ริม" },
    { key: "หน้าบ้าน/หน้าสวน" },
    { key: "หน้าบ้านไม่ชนใคร" },
    { key: "ปกติ" },
    { key: "ไม่ใกล้ลิฟต์" },
    { key: "ไม่ใกล้ห้องขยะ" },
    { key: "วิวโล่ง/วิวสวน" },
    { key: "หน้าห้องไม่ชนใคร" },
  ],
  price_remark: [
    { key: "50/50 Transfer Fee" },
    { key: "All Included" },
    { key: "All Tax Not Included" },
  ],
  unit_condition: [
    { key: "Great", tone: "good" },
    { key: "Good", tone: "info" },
    { key: "Bad", tone: "warn" },
    { key: "Broken", tone: "bad" },
  ],
  location_grade: [
    { key: "A", tone: "accent" },
    { key: "B", tone: "info" },
    { key: "C", tone: "muted" },
  ],
  listing_channel: [
    { key: "Ddproperty" },
    { key: "Livinginsider" },
    { key: "PropertyHub" },
    { key: "FB Group" },
    { key: "FB Page" },
  ],
  lead_type: [
    { key: "Owner - Sale" },
    { key: "Owner - Rent" },
    { key: "Owner - Others" },
    { key: "Buyer - Buy" },
    { key: "Buyer - Rent" },
    { key: "Co-Agent" },
  ],
  marketing_channel: [
    { key: "Ddproperty" },
    { key: "Livinginsider" },
    { key: "Propertyhub" },
    { key: "Facebook Organic" },
    { key: "Facebook Ad" },
    { key: "ป้าย Offline" },
    { key: "Referral" },
    { key: "อื่นๆ" },
  ],
  contact_by: [
    { key: "Call" },
    { key: "LINE OA" },
    { key: "Facebook Inbox" },
    { key: "Ddproperty Inbox" },
    { key: "Livinginsider Inbox" },
    { key: "Email" },
    { key: "Personal" },
  ],
  lead_status: [
    { key: "Active", tone: "good", role: "open", system: true },
    { key: "Lose", tone: "bad", role: "lost" },
    { key: "Reject", tone: "bad", role: "lost" },
    { key: "Sold", tone: "accent", role: "won", system: true },
    { key: "Cancel", tone: "muted" },
  ],
  case_status: [
    { key: "Completed", tone: "good" },
    { key: "Failed", tone: "bad" },
    { key: "Cancel", tone: "muted" },
    { key: "Success!", tone: "accent" },
  ],
  complain_severity: [
    { key: "Small", tone: "warn" },
    { key: "Serious", tone: "bad" },
    { key: "Critical", tone: "bad" },
  ],
  complain_status: [
    { key: "In Progress", tone: "warn" },
    { key: "Resolved", tone: "good" },
    { key: "Failed", tone: "bad" },
  ],
  closing_status: [
    { key: "Reserved", tone: "info" },
    { key: "Sign Contract", tone: "info" },
    { key: "Banking", tone: "warn" },
    { key: "In Progress", tone: "info" },
    { key: "EX", tone: "warn" },
    { key: "Done", tone: "good" },
    { key: "Failed", tone: "bad", role: "dead" },
    { key: "Com. Paid", tone: "accent", role: "settled", system: true },
  ],
  last_match_type: [
    { key: "ปิดเอง", tone: "accent" },
    { key: "คนอื่นปิด", tone: "info" },
    { key: "เจ้าของขายเอง", tone: "warn" },
    { key: "เอเจ้นอื่นขายไป", tone: "warn" },
    { key: "ไม่รู้", tone: "muted" },
  ],
  action_category: [
    { key: "New List" },
    { key: "Owner Visit" },
    { key: "Owner Talk" },
    { key: "Survey" },
    { key: "Call" },
    { key: "Follow" },
    { key: "Appoint" },
    { key: "Show" },
    { key: "Nego" },
    { key: "Close" },
    { key: "โอนกรรมสิทธิ์" },
    { key: "เปลี่ยนน้ำ,ไฟ" },
    { key: "เปิดประเมิน" },
    { key: "ประชุม" },
    { key: "ทำงานหน้าคอม" },
    { key: "อื่นๆ (ระบุ Remark)" },
  ],
  task_type: [
    { key: "สร้างยอด", tone: "accent" },
    { key: "งานประจำ", tone: "info" },
    { key: "ส่วนตัว", tone: "muted" },
  ],
  payout_role: [
    { key: "เซลส์", linkedKey: "ส่วนแบ่งคอม เซลส์" },
    { key: "Co-Agent", linkedKey: "ส่วนแบ่งคอม Co-Agent" },
    { key: "ที่ปรึกษา", linkedKey: "ส่วนแบ่งคอมมิชชั่นอื่นๆ" },
    { key: "อื่นๆ", linkedKey: "ส่วนแบ่งคอมมิชชั่นอื่นๆ" },
  ],
  ledger_category: [
    { key: "ค่าคอมมิชชั่นรับ", tone: "accent", role: "commission_income", system: true, section: "revenue" },
    { key: "รายได้อื่นๆ", section: "revenue" },
    { key: "ส่วนแบ่งคอม เซลส์", section: "cogs" },
    { key: "ส่วนแบ่งคอม Co-Agent", section: "cogs" },
    { key: "ส่วนแบ่งคอมมิชชั่นอื่นๆ", role: "commission_split", system: true, section: "cogs" },
    { key: "เงินเดือน", section: "fixed" },
    { key: "ประกันสังคม", section: "fixed" },
    { key: "ค่าเช่า/ออฟฟิศ", section: "fixed" },
    { key: "ค่าโฆษณา Facebook", section: "variable" },
    { key: "ค่าโฆษณาเว็บอสังหาฯ", section: "variable" },
    { key: "ค่าดำเนินงานอื่นๆ", section: "variable" },
    { key: "แบรนด์/ระบบ/เครื่องมือ", section: "growth" },
    { key: "เงินทุน / เงินกู้เจ้าของ", section: "financing" },
  ],
  // Seeded with the values the HR import actually produced, NOT a tidy Thai
  // list — renaming them to Thai is a Settings click, and the rename rewrites
  // users.employment_status through the kind registry. Seeding Thai here
  // instead would have orphaned every existing row.
  employment_status: [
    { key: "Active", tone: "good" },
    { key: "Inactive", tone: "muted", role: "departed" },
  ],
  trust_trigger: [
    { key: "เชื่อจากข้อมูลรองรับ" },
    { key: "เชื่อจากความสัมพันธ์" },
    { key: "เชื่อจากภาพลักษณ์ที่ดูน่าเชื่อถือ" },
    { key: "เชื่อจาก Social Proof" },
  ],
};
