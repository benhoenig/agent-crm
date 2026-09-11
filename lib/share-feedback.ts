/** The buyer's "ยังไม่ใช่" reason list — shared by the public share page and
    its action (a "use server" file may only export async functions). */
export const REJECT_REASONS = [
  "ราคาสูงไป",
  "ทำเลไม่ใช่",
  "แปลน/ขนาดไม่ตรงใจ",
  "สภาพห้อง",
  "อื่นๆ",
] as const;
