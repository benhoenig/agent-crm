import "server-only";
import OpenAI from "openai";

/* Paste-to-form extraction — ported from the Klaichan/Mook CRM (itself from
   Shelter's proven architecture). The model READS raw Thai text into a
   strict JSON schema; it never decides record matching (deterministic code
   in lib/ai/parse.ts) and never saves (the form pre-fills; the user reviews
   before บันทึก). */

/** One line to swap tiers. */
export const AI_MODEL = "gpt-4.1";

/* Every business vocabulary the model may return comes from the options
   catalog, passed in per call rather than frozen here. Not cosmetic: the
   schema is what the model is ALLOWED to return, so a value the client adds
   in Settings could never be extracted until the list knew about it. */
export interface ListingEnums {
  propertyTypes: string[];
  listingTypes: string[];
  directions: string[];
  conditions: string[];
}
export interface LeadEnums {
  potentials: string[];
  channels: string[];
}

/** Thrown with a stable code the job runner maps to a Thai user message. */
export class AiError extends Error {}

/** Is the parser usable at all? The create forms ask before rendering the
    paste box, so an unset key is a remark on a disabled field rather than a
    pasted message that queues, runs and fails four seconds later. */
export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new AiError("OPENAI_API_KEY_MISSING");
  return (_client ??= new OpenAI());
}

/** Map an OpenAI SDK error to a stable AiError code. */
function classify(e: unknown): string {
  const err = e as { status?: number; code?: string; type?: string; name?: string };
  const status = err?.status;
  const code = err?.code ?? err?.type;
  if (status === 401 || status === 403) return "AI_BAD_KEY";
  if (status === 429)
    return code === "insufficient_quota" ? "AI_NO_CREDIT" : "AI_RATE_LIMIT";
  if (typeof status === "number" && status >= 500) return "AI_UNAVAILABLE";
  if (err?.name === "APIConnectionError" || err?.name === "APIConnectionTimeoutError")
    return "AI_UNAVAILABLE";
  return "AI_REQUEST_FAILED";
}

/** Nullable field helpers for OpenAI strict mode (every property required;
    "absent" is an allowed null). */
const nullable = (values?: string[]) =>
  values
    ? { type: ["string", "null"], enum: [...values, null] }
    : { type: ["string", "null"] };
const nullableNum = (kind: "number" | "integer") => ({ type: [kind, "null"] });

export type Usage = { model: string; inputTokens: number; outputTokens: number };

/** Run one strict-JSON-schema extraction. */
async function extract<T>(
  schemaName: string,
  properties: Record<string, unknown>,
  system: string,
  raw: string
): Promise<{ data: T; usage: Usage }> {
  let completion;
  try {
    completion = await client().chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: raw },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema: {
            type: "object",
            properties,
            required: Object.keys(properties),
            additionalProperties: false,
          },
        },
      },
    });
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(classify(e));
  }
  const msg = completion.choices[0]?.message;
  if (msg?.refusal) throw new AiError("AI_REFUSED");
  if (!msg?.content) throw new AiError("AI_EMPTY");
  let data: T;
  try {
    data = JSON.parse(msg.content) as T;
  } catch {
    throw new AiError("AI_BAD_JSON");
  }
  return {
    data,
    usage: {
      model: completion.model || AI_MODEL,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
  };
}

const THAI_NUMBERS =
  "แปลงจำนวนเงินภาษาไทยเป็นตัวเลขบาทเสมอ: ล้าน = 1,000,000 · แสน = 100,000 · หมื่น = 10,000 · พัน = 1,000 " +
  '(เช่น "5.9 ล้าน" → 5900000, "3 แสน 5" → 350000). ตัดเครื่องหมายจุลภาคออก. ถ้าไม่พบข้อมูลของช่องใด ให้ตอบ null — ห้ามเดาหรือแต่งขึ้นเอง.';

export type ListingDraft = {
  projectName: string | null;
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
  condition: string | null;
  askingPrice: number | null;
  rentalPrice: number | null;
  priceRemark: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerLine: string | null;
};

export async function extractListing(
  raw: string,
  enums: ListingEnums
): Promise<{ draft: ListingDraft; usage: Usage }> {
  const system =
    "คุณคือผู้ช่วยกรอกข้อมูลทรัพย์อสังหาฯ ให้ทีมขาย ดึงข้อมูลจากข้อความดิบที่ผู้ใช้วางมา (ภาษาไทย) ลงในโครงสร้างที่กำหนด\n" +
    "- projectName: ชื่อโครงการ/คอนโด/หมู่บ้าน\n" +
    "- propertyType: เลือกจากรายการที่กำหนดเท่านั้น ถ้าไม่ตรงให้ null\n" +
    '- listingType: เลือกจากรายการที่กำหนด — "Sale" ถ้าขาย · "Rent" ถ้าปล่อยเช่า · "Sale & Rent" ถ้าทั้งขายและให้เช่า · "Sale with Tenant" ถ้าขายพร้อมผู้เช่า\n' +
    "- zone: ทำเล/ย่าน (เช่น รัชดา / อโศก)\n" +
    '- bts / mrt: ชื่อสถานีรถไฟฟ้าใกล้ทรัพย์ ถ้าระบุ\n' +
    "- unitTypeName: ชื่อไทป์ห้อง (เช่น สตูดิโอ / 1 Bed Plus) · unitNo: เลขห้อง/บ้านเลขที่\n" +
    "- bed/bath: จำนวนเต็ม (สตูดิโอ → bed 0) · sqm: พื้นที่ใช้สอย ตร.ม.\n" +
    '- landRai / landNgan / landWa: ขนาดที่ดินแยกเป็น ไร่ / งาน / ตารางวา\n' +
    '- floor: ชั้น ("ชั้น 8" → "8") · building: ตึก/อาคาร ("ตึก A" → "A")\n' +
    "- view: วิว · direction: ทิศ เลือกจากรายการ (ภาษาอังกฤษ เช่น เหนือ → North) · position: ตำแหน่งห้อง · parking: ที่จอดรถ\n" +
    '- condition: สภาพห้อง — "Great" ใหม่/รีโนเวท · "Good" สภาพดี · "Bad" ทรุดโทรม · "Broken" เสียหาย · ไม่ระบุ → null\n' +
    "- askingPrice: ราคาขาย · rentalPrice: ค่าเช่าต่อเดือน (มีทั้งคู่ให้ใส่ทั้งคู่) · priceRemark: หมายเหตุราคา\n" +
    '- ownerName / ownerPhone / ownerLine: ชื่อ เบอร์ และ LINE ของเจ้าของ — ตัดคำนำหน้าออก (คุณ/นาย/นาง/K.) · ownerPhone เฉพาะตัวเลข\n' +
    THAI_NUMBERS;
  const { data, usage } = await extract<ListingDraft>(
    "listing_draft",
    {
      projectName: nullable(),
      propertyType: nullable(enums.propertyTypes),
      listingType: nullable(enums.listingTypes),
      zone: nullable(),
      bts: nullable(),
      mrt: nullable(),
      unitTypeName: nullable(),
      unitNo: nullable(),
      bed: nullableNum("integer"),
      bath: nullableNum("integer"),
      sqm: nullableNum("number"),
      landRai: nullableNum("number"),
      landNgan: nullableNum("number"),
      landWa: nullableNum("number"),
      floor: nullable(),
      building: nullable(),
      view: nullable(),
      direction: nullable(enums.directions),
      position: nullable(),
      parking: nullable(),
      condition: nullable(enums.conditions),
      askingPrice: nullableNum("number"),
      rentalPrice: nullableNum("number"),
      priceRemark: nullable(),
      ownerName: nullable(),
      ownerPhone: nullable(),
      ownerLine: nullable(),
    },
    system,
    raw
  );
  return { draft: data, usage };
}

export type LeadDraft = {
  name: string | null;
  phone: string | null;
  lineId: string | null;
  potential: string | null;
  channel: string | null;
  budgetMillion: number | null;
  listingCode: string | null;
  projectsInterested: string[];
  background: string | null;
  requirement: string | null;
  painPoint: string | null;
  timeline: string | null;
};

/** Contact + deal + DISCOVERY fields from a raw inbound-lead message or a
    pasted LINE conversation. */
export async function extractLead(
  raw: string,
  enums: LeadEnums
): Promise<{ draft: LeadDraft; usage: Usage }> {
  const system =
    "คุณคือผู้ช่วยกรอกข้อมูลลูกค้า (lead) ให้ทีมขายอสังหาฯ ดึงข้อมูลจากข้อความดิบ (ภาษาไทย) อาจเป็นข้อความสั้นหรือบทสนทนา LINE ทั้งบท\n" +
    '- name: ชื่อผู้ติดต่อ — ตัดคำนำหน้าออก (คุณ/นาย/นาง/K./Mr.) เช่น "คุณสมชาย" → "สมชาย"\n' +
    "- phone: เบอร์โทร (เฉพาะตัวเลข) · lineId: LINE ID ถ้ามี\n" +
    `- potential: ระดับความสนใจ เลือกจาก (${enums.potentials.join("/")}) ถ้าระบุ ไม่ระบุให้ null\n` +
    "- channel: ช่องทางที่ลูกค้าติดต่อมา เลือกจากรายการที่กำหนดเท่านั้น ถ้าไม่ตรง/ไม่ทราบให้ null\n" +
    '- budgetMillion: งบประมาณเป็นหน่วยล้านบาท (เช่น "งบ 3.5-4 ล้าน" → 4, "ไม่เกิน 5 ล้าน" → 5) ไม่ระบุ → null\n' +
    '- listingCode: รหัสทรัพย์ ถ้าระบุ (เช่น "HBH-ST-11")\n' +
    "- projectsInterested: ชื่อโครงการที่ลูกค้าสนใจ ใส่ให้ครบทุกโครงการที่พูดถึง ถ้าไม่มีให้เป็น []\n" +
    "- background: พื้นเพลูกค้า — อาชีพ ที่อยู่ ครอบครัว เหตุผลที่หา สรุปเป็นข้อ ๆ (ขึ้นบรรทัดใหม่ด้วย - )\n" +
    "- requirement: สเปคที่ต้องการ — ทำเล ไซส์ ไทป์ งบ เงื่อนไข สรุปเป็นข้อ ๆ\n" +
    "- painPoint: สิ่งที่สำคัญที่สุด/กังวลที่สุดของลูกค้า สรุปเป็นข้อ ๆ\n" +
    "- timeline: กรอบเวลาที่ต้องการซื้อ/ย้ายเข้า\n" +
    "background/requirement/painPoint/timeline: สรุปจากบทสนทนาเท่าที่มีจริง ถ้าไม่มีข้อมูลให้ null\n" +
    "ถ้าไม่พบข้อมูลของช่องใด ให้ตอบ null — ห้ามเดาหรือแต่งขึ้นเอง";
  const { data, usage } = await extract<LeadDraft>(
    "lead_draft",
    {
      name: nullable(),
      phone: nullable(),
      lineId: nullable(),
      potential: nullable(enums.potentials),
      channel: nullable(enums.channels),
      budgetMillion: nullableNum("number"),
      listingCode: nullable(),
      projectsInterested: { type: "array", items: { type: "string" } },
      background: nullable(),
      requirement: nullable(),
      painPoint: nullable(),
      timeline: nullable(),
    },
    system,
    raw
  );
  return { draft: data, usage };
}
