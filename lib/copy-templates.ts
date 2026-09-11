/* Post templates — DEFAULTS for the copywriting generator (deliberately no
   AI: a post is brand voice, and voice is written once, not sampled).
   Engine ported from the Klaichan/Mook CRM; the TEXT below is a neutral
   HABIHUB starting point, because the source project's templates carry
   another agency's brand and contact block.

   ⚠ Settings → เทมเพลตโพสต์ is where the real voice goes — including the
   ติดต่อ block. Everything here is overridable per (type × tier); a stored
   override wins, "คืนค่าเริ่มต้น" falls back to exactly this file.

   Placeholders use <Field> syntax; lib/copy-render.ts fills them and PRUNES
   line segments whose fields are empty, so a listing without a ตึก never
   ships a post reading "🧡 ตึก" with nothing after it. */

export type CopyTier = "high" | "low";
export type CopyChannel = "normal" | "dd";

/** Placeholder names with Thai labels — the studio's "ยังไม่ได้กรอก" warning
    and the Settings editor's insert chips both read from here. Values come
    from valuesFor() in lib/copy-render.ts; the two lists stay in step. */
export const PLACEHOLDER_LABELS: Record<string, string> = {
  "Post Remark": "จุดขายสำหรับโพสต์",
  "Project Name (Eng)": "ชื่อโครงการ (อังกฤษ)",
  "Project Name (Thai)": "ชื่อโครงการ (ไทย)",
  "Listing ID": "รหัสทรัพย์",
  "Bed": "ห้องนอน",
  "Bath": "ห้องน้ำ",
  "Sqm.": "ขนาด (ตร.ม.)",
  "Floor": "ชั้น",
  "Building": "ตึก",
  "Parking": "ที่จอดรถ",
  "Direction": "ทิศ",
  "View": "วิว",
  "Zone": "โซน",
  "Asking Price": "ราคาขาย",
  "Rental Price": "ค่าเช่า",
  "Price Remark": "หมายเหตุราคา",
};

export interface TemplateSet {
  /** Post title / first line. */
  headline: string;
  /** Facebook / LINE body. */
  normal: string;
  /** DDproperty & portal body (plain marks, no emoji). */
  dd: string;
}

const SPECS_EMOJI = `🛏 <Bed> ห้องนอน / <Bath> ห้องน้ำ
📐 <Sqm.> ตร.ม. ชั้น <Floor> ตึก <Building>
🧭 ทิศ<Direction> วิว<View>
🚗 ที่จอดรถ <Parking>`;

const SPECS_PLAIN = `- <Bed> ห้องนอน / <Bath> ห้องน้ำ
- <Sqm.> ตร.ม. ชั้น <Floor> ตึก <Building>
- ทิศ<Direction> วิว<View>
- ที่จอดรถ <Parking>`;

const PRICE_EMOJI = `💰 ขาย <Asking Price> บาท
💰 เช่า <Rental Price> บาท/เดือน
(<Price Remark>)`;

const PRICE_PLAIN = `ราคาขาย <Asking Price> บาท
ค่าเช่า <Rental Price> บาท/เดือน
(<Price Remark>)`;

const FOOT_EMOJI = `📌 รหัสทรัพย์ <Listing ID>
สนใจนัดชม ทักได้เลยครับ/ค่ะ`;

const FOOT_PLAIN = `รหัสทรัพย์ <Listing ID>
สนใจนัดชม ติดต่อได้เลย`;

export const POST_TEMPLATES: Record<string, TemplateSet> = {
  "Sale|high": {
    headline: `🔥 <Post Remark> | ขาย <Project Name (Eng)> <Project Name (Thai)>`,
    normal: `🔥 <Post Remark>

ขายคอนโด <Project Name (Eng)> <Project Name (Thai)> โซน<Zone>

${SPECS_EMOJI}

${PRICE_EMOJI}

${FOOT_EMOJI}`,
    dd: `<Post Remark>

ขาย <Project Name (Eng)> <Project Name (Thai)> โซน<Zone>

${SPECS_PLAIN}

${PRICE_PLAIN}

${FOOT_PLAIN}`,
  },
  "Sale|low": {
    headline: `ขาย <Project Name (Eng)> <Project Name (Thai)>`,
    normal: `ขาย <Project Name (Eng)> <Project Name (Thai)> โซน<Zone>

<Post Remark>

${SPECS_EMOJI}

${PRICE_EMOJI}

${FOOT_EMOJI}`,
    dd: `ขาย <Project Name (Eng)> <Project Name (Thai)> โซน<Zone>

<Post Remark>

${SPECS_PLAIN}

${PRICE_PLAIN}

${FOOT_PLAIN}`,
  },
  "Rent|high": {
    headline: `🔥 <Post Remark> | เช่า <Project Name (Eng)> <Project Name (Thai)>`,
    normal: `🔥 <Post Remark>

ให้เช่าคอนโด <Project Name (Eng)> <Project Name (Thai)> โซน<Zone>

${SPECS_EMOJI}

💰 เช่า <Rental Price> บาท/เดือน
(<Price Remark>)

${FOOT_EMOJI}`,
    dd: `<Post Remark>

ให้เช่า <Project Name (Eng)> <Project Name (Thai)> โซน<Zone>

${SPECS_PLAIN}

ค่าเช่า <Rental Price> บาท/เดือน
(<Price Remark>)

${FOOT_PLAIN}`,
  },
  "Rent|low": {
    headline: `เช่า <Project Name (Eng)> <Project Name (Thai)>`,
    normal: `ให้เช่า <Project Name (Eng)> <Project Name (Thai)> โซน<Zone>

<Post Remark>

${SPECS_EMOJI}

💰 เช่า <Rental Price> บาท/เดือน
(<Price Remark>)

${FOOT_EMOJI}`,
    dd: `ให้เช่า <Project Name (Eng)> <Project Name (Thai)> โซน<Zone>

<Post Remark>

${SPECS_PLAIN}

ค่าเช่า <Rental Price> บาท/เดือน
(<Price Remark>)

${FOOT_PLAIN}`,
  },
};
