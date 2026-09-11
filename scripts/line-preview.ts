// Renders the /plan Flex card with sample data so it can be checked in the
// LINE Flex Message Simulator (https://developers.line.biz/flex-simulator/)
// without a LINE channel, a webhook, or real DB rows.
//
//   pnpm line:preview              → writes line-preview/*.json (gitignored)
//   pnpm line:preview -- --print busy   → that bubble's JSON on stdout
//
// Paste a file's contents into the simulator's JSON pane. The simulator takes
// the BUBBLE object, which is the flex message's `contents` field — not the
// {type:"flex", altText, contents} envelope the Messaging API wants.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { personalPlanCard, thaiDateLabel } from "../lib/line/flex";

const APP_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const DATE_LABEL = thaiDateLabel("2026-08-17");

// Three states worth eyeballing: a full day, a fresh/empty day (no active
// goal → the goal bar is omitted entirely), and an approved leave day.
const VARIANTS = {
  busy: personalPlanCard(
    { name: "โด", goalPct: 68 },
    [
      { title: "โทรตามเจ้าของ HBH-ST-12 (ค้าง 4 วัน)", done: true, startTime: "09:00" },
      { title: "อัปเดตราคา Ideo Q สาทร", done: true, startTime: null },
      { title: "พาลูกค้าดูห้อง The Room สาทร ชั้น 21", done: false, startTime: "13:30" },
      { title: "ตาม Lead คุณเมย์ (เกรด A ค้าง 3 วัน)", done: false, startTime: "16:00" },
      { title: "ถ่ายรูปใหม่ HBH-ST-9 ส่งทีมมาร์เก็ตติ้ง", done: false, startTime: null },
    ],
    { dateLabel: DATE_LABEL, appUrl: APP_URL, onLeave: false }
  ),
  empty: personalPlanCard(
    { name: "พลอย", goalPct: null },
    [],
    { dateLabel: DATE_LABEL, appUrl: APP_URL, onLeave: false }
  ),
  "on-leave": personalPlanCard(
    { name: "สตางค์", goalPct: 104 },
    [],
    { dateLabel: DATE_LABEL, appUrl: APP_URL, onLeave: true }
  ),
} as const;

const printFlag = process.argv.indexOf("--print");
if (printFlag !== -1) {
  const key = process.argv[printFlag + 1] as keyof typeof VARIANTS;
  const variant = VARIANTS[key];
  if (!variant) {
    console.error(`Unknown variant "${key}" (${Object.keys(VARIANTS).join(" | ")})`);
    process.exit(1);
  }
  console.log(JSON.stringify(variant.contents, null, 2));
} else {
  const outDir = join(process.cwd(), "line-preview");
  mkdirSync(outDir, { recursive: true });
  for (const [name, card] of Object.entries(VARIANTS)) {
    const file = join(outDir, `${name}.json`);
    writeFileSync(file, JSON.stringify(card.contents, null, 2));
    console.log(`${file}\n  altText: ${card.altText}`);
  }
  console.log(
    "\nPaste a file into https://developers.line.biz/flex-simulator/ (Showcase → paste JSON)."
  );
}
