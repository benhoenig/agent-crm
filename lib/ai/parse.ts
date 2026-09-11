import "server-only";

/* The parse core — the AI reads; CODE decides. Record matching (legacy
   codes, project names, owner phones → real rows) is deterministic here
   because the model mismatches ~20% of the time (the upstream project's
   measured finding). Called by the job runner in lib/ai/jobs.ts, which owns
   auth and passes the user in. */

import { asc, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiUsage, listings, contacts, projects } from "@/lib/db/schema";
import { optionKeys } from "@/lib/repo/options";
import { AI_NOT_CONFIGURED } from "./config";
import {
  AiError,
  extractLead,
  extractListing,
  type Usage,
} from "./extract";

/** Error code → the Thai sentence the tray shows. */
export function messageFor(e: unknown): string {
  const code = e instanceof AiError ? e.message : "";
  switch (code) {
    case "OPENAI_API_KEY_MISSING":
      return AI_NOT_CONFIGURED;
    case "AI_BAD_KEY":
      return "API key ไม่ถูกต้องหรือหมดอายุ — แจ้งแอดมิน";
    case "AI_NO_CREDIT":
      return "เครดิต OpenAI หมด — แจ้งแอดมินเติมเครดิต";
    case "AI_RATE_LIMIT":
      return "ใช้งานถี่เกินไป รอสักครู่แล้วลองใหม่";
    case "AI_UNAVAILABLE":
      return "ระบบ AI ขัดข้องชั่วคราว ลองใหม่อีกครั้ง";
    case "AI_REFUSED":
      return "AI ไม่สามารถอ่านข้อความนี้ได้ ลองแก้ข้อความแล้วลองใหม่";
    default:
      return "แยกข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง";
  }
}

/** Best-effort token log — never blocks or fails a parse. */
async function recordUsage(userId: string, kind: "listing" | "lead", usage: Usage) {
  try {
    await getDb().insert(aiUsage).values({
      userId,
      kind,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
  } catch {
    /* non-critical */
  }
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const digits = (s: string) => s.replace(/\D/g, "");

/** Digits-only exact phone match — same dedupe rule as the create path. */
async function matchOwnerByPhone(
  phone: string | null
): Promise<{ id: string; name: string | null } | null> {
  const want = phone ? digits(phone) : "";
  if (want.length < 8) return null;
  const rows = await getDb()
    .select({ id: contacts.id, name: contacts.name, phone: contacts.phone })
    .from(contacts)
    .where(isNotNull(contacts.phone));
  const hit = rows.find((c) => c.phone && digits(c.phone) === want);
  return hit ? { id: hit.id, name: hit.name } : null;
}

async function matchContactByPhone(
  phone: string | null
): Promise<{ id: string; name: string | null } | null> {
  const want = phone ? digits(phone) : "";
  if (want.length < 8) return null;
  const rows = await getDb()
    .select({ id: contacts.id, name: contacts.name, phone: contacts.phone })
    .from(contacts)
    .where(isNotNull(contacts.phone));
  const hit = rows.find((c) => c.phone && digits(c.phone) === want);
  return hit ? { id: hit.id, name: hit.name } : null;
}

type ProjectRow = { id: string; nameThai: string | null; nameEng: string | null };
const projectRows = () =>
  getDb()
    .select({ id: projects.id, nameThai: projects.nameThai, nameEng: projects.nameEng })
    .from(projects);

/** Exact normalized match first, then containment either direction. No
    confident match → null (the user picks on the form). */
function matchProjectIn(rows: ProjectRow[], name: string) {
  const want = norm(name);
  if (!want) return null;
  const nm = (p: ProjectRow) => norm(p.nameThai ?? "");
  const ne = (p: ProjectRow) => norm(p.nameEng ?? "");
  const hit =
    rows.find((p) => nm(p) === want || ne(p) === want) ??
    rows.find(
      (p) =>
        (nm(p) && (nm(p).includes(want) || want.includes(nm(p)))) ||
        (ne(p) && (ne(p).includes(want) || want.includes(ne(p))))
    );
  return hit ? { id: hit.id, name: hit.nameThai ?? hit.nameEng ?? "" } : null;
}

export type ListingParseDraft = {
  listingName: string | null;
  propertyType: string | null;
  listingType: string | null;
  zone: string | null;
  bts: string | null;
  mrt: string | null;
  unitTypeName: string | null;
  unitNo: string | null;
  bed: number | null;
  bath: number | null;
  sqm: number | null;
  landRai: number | null;
  landNgan: number | null;
  landWa: number | null;
  floor: string | null;
  building: string | null;
  view: string | null;
  direction: string | null;
  position: string | null;
  parking: string | null;
  unitCondition: string | null;
  askingPrice: number | null;
  rentalPrice: number | null;
  priceRemark: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerLine: string | null;
  /** Deterministic matches — set when phone/name hit an existing record. */
  ownerId: string | null;
  projectId: string | null;
  projectName: string | null;
};

export type ListingParseResult =
  | { ok: true; note: string | null; draft: ListingParseDraft; title: string | null }
  | { ok: false; error: string };

export async function parseListing(
  raw: string,
  userId: string
): Promise<ListingParseResult> {
  const text = raw.trim();
  if (!text) return { ok: false, error: "กรุณาวางข้อความก่อน" };
  try {
    const [propertyTypes, listingTypes, directions, conditions] =
      await Promise.all([
        optionKeys("property_type"),
        optionKeys("listing_type"),
        optionKeys("direction"),
        optionKeys("unit_condition"),
      ]);
    const { draft: d, usage } = await extractListing(text, {
      propertyTypes,
      listingTypes,
      directions,
      conditions,
    });
    await recordUsage(userId, "listing", usage);

    // Sale/Rent inference fallback when the model left it null
    const listingType =
      d.listingType ??
      (d.askingPrice != null && d.rentalPrice != null
        ? "Sale & Rent"
        : d.rentalPrice != null
          ? "Rent"
          : d.askingPrice != null
            ? "Sale"
            : null);

    const notes: string[] = [];
    const ownerHit = await matchOwnerByPhone(d.ownerPhone);
    if (ownerHit) notes.push(`พบเจ้าของเดิม “${ownerHit.name ?? "ไม่มีชื่อ"}” จากเบอร์โทร`);
    else if (d.ownerName) notes.push(`จะสร้างเจ้าของใหม่ “${d.ownerName}” เมื่อบันทึก`);

    const projectHit = d.projectName
      ? matchProjectIn(await projectRows(), d.projectName)
      : null;
    if (projectHit) notes.push(`จับคู่โครงการ “${projectHit.name}”`);
    else if (d.projectName)
      notes.push(`ไม่พบโครงการ “${d.projectName}” — เลือกหรือสร้างเองในฟอร์ม`);

    if (d.zone) notes.push(`ทำเลที่อ่านได้: ${d.zone} — เลือกโซนเองในฟอร์ม`);
    if (d.bts || d.mrt)
      notes.push(
        `สถานีที่อ่านได้: ${[d.bts && `BTS ${d.bts}`, d.mrt && `MRT ${d.mrt}`].filter(Boolean).join(" · ")} — เลือกสถานีเองในฟอร์ม`
      );

    return {
      ok: true,
      note: notes.length ? notes.join(" · ") : null,
      title: d.projectName,
      draft: {
        listingName: d.projectName,
        propertyType: d.propertyType,
        listingType,
        zone: d.zone,
        bts: d.bts,
        mrt: d.mrt,
        unitTypeName: d.unitTypeName,
        unitNo: d.unitNo,
        bed: d.bed,
        bath: d.bath,
        sqm: d.sqm,
        landRai: d.landRai,
        landNgan: d.landNgan,
        landWa: d.landWa,
        floor: d.floor,
        building: d.building,
        view: d.view,
        direction: d.direction,
        position: d.position,
        parking: d.parking,
        unitCondition: d.condition,
        askingPrice: d.askingPrice,
        rentalPrice: d.rentalPrice,
        priceRemark: d.priceRemark,
        ownerName: d.ownerName,
        ownerPhone: d.ownerPhone ? digits(d.ownerPhone) : null,
        ownerLine: d.ownerLine,
        ownerId: ownerHit?.id ?? null,
        projectId: projectHit?.id ?? null,
        projectName: projectHit?.name ?? d.projectName,
      },
    };
  } catch (e) {
    return { ok: false, error: messageFor(e) };
  }
}

export type LeadParseDraft = {
  name: string | null;
  phone: string | null;
  lineId: string | null;
  contactId: string | null;
  contactName: string | null;
  potential: string | null;
  channel: string | null;
  budgetMillion: number | null;
  listingId: string | null;
  initialInterest: string | null;
  background: string | null;
  requirement: string | null;
  painPoint: string | null;
  timeline: string | null;
};

export type LeadParseResult =
  | { ok: true; note: string | null; draft: LeadParseDraft; title: string | null }
  | { ok: false; error: string };

export async function parseLead(
  raw: string,
  userId: string
): Promise<LeadParseResult> {
  const text = raw.trim();
  if (!text) return { ok: false, error: "กรุณาวางข้อความก่อน" };
  try {
    const [potentials, channels] = await Promise.all([
      optionKeys("lead_potential"),
      optionKeys("marketing_channel"),
    ]);
    const { draft: d, usage } = await extractLead(text, { potentials, channels });
    await recordUsage(userId, "lead", usage);

    const notes: string[] = [];
    const contactHit = await matchContactByPhone(d.phone);
    if (contactHit)
      notes.push(`พบผู้ติดต่อเดิม “${contactHit.name ?? "ไม่มีชื่อ"}” จากเบอร์โทร`);
    else if (d.name) notes.push(`จะสร้างผู้ติดต่อใหม่ “${d.name}” เมื่อบันทึก`);

    // Deterministic listing match: legacy code exact first, then project-name
    // containment against listing names.
    let listingId: string | null = null;
    const rows = await getDb()
      .select({
        id: listings.id,
        name: listings.listingName,
        legacy: listings.legacyCode,
      })
      .from(listings)
      .orderBy(asc(listings.createdAt));
    const wantCode = d.listingCode?.trim().toUpperCase() ?? null;
    if (wantCode) {
      const hit = rows.find((l) => l.legacy?.toUpperCase() === wantCode);
      if (hit) {
        listingId = hit.id;
        notes.push(`จับคู่ทรัพย์ ${hit.legacy} “${hit.name ?? ""}”`);
      } else {
        notes.push(`ไม่พบรหัส ${wantCode} ในระบบ — ตรวจสอบอีกครั้ง`);
      }
    } else if (d.projectsInterested.length) {
      const want = norm(d.projectsInterested[0]);
      const hit =
        rows.find((l) => l.name && norm(l.name) === want) ??
        rows.find(
          (l) =>
            l.name && (norm(l.name).includes(want) || want.includes(norm(l.name)))
        );
      if (hit) {
        listingId = hit.id;
        notes.push(`จับคู่ทรัพย์ “${hit.name}” จากชื่อโครงการ`);
      }
    }

    return {
      ok: true,
      note: notes.length ? notes.join(" · ") : null,
      title: d.name,
      draft: {
        name: d.name,
        phone: d.phone ? digits(d.phone) : null,
        lineId: d.lineId,
        contactId: contactHit?.id ?? null,
        contactName: contactHit?.name ?? null,
        potential: d.potential,
        channel: d.channel,
        budgetMillion: d.budgetMillion,
        listingId,
        initialInterest: d.projectsInterested.length
          ? d.projectsInterested.join(", ")
          : null,
        background: d.background,
        requirement: d.requirement,
        painPoint: d.painPoint,
        timeline: d.timeline,
      },
    };
  } catch (e) {
    return { ok: false, error: messageFor(e) };
  }
}
