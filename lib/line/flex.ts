import { APP_NAME } from "@/lib/brand";

// Flex Message builder for the /plan reply card (personalPlanCard port from
// Solo Gang, restyled to Habihub's tokens). Pure + data-driven.
//
// LINE chat is always light, so the palette is the LIGHT theme from
// globals.css. Lime is a FILL color only — text on white uses olive
// (--accent-text light), and text ON lime uses the dark accent-ink, exactly
// like the app. The avatar is an initial in a lime-tinted circle: R2 avatars
// sit behind the session-gated /media route, which LINE's image fetcher
// (no session) can't read — an initial keeps the bucket private.

const LIME = "#b8e43c"; // --accent (light) — fills: progress, button
const LIME_SOFT = "#eef5d8"; // --accent-soft on white — avatar circle
const OLIVE = "#55700a"; // --accent-text (light) — accent-colored text
const INK = "#171b16"; // --ink
const INK2 = "#4c544c"; // --ink-2
const INK3 = "#8a938a"; // --ink-3
const ACCENT_INK = "#131909"; // --accent-ink — text on lime
const TRACK = "#edf1e8"; // --surface-3 — bar track
const GOOD = "#2f9e57"; // --good

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** "2026-08-17" → "17 สิงหาคม 2569" (Buddhist era, matches lib/format.ts). */
export function thaiDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${TH_MONTHS[m - 1] ?? m} ${y + 543}`;
}

type FlexNode = Record<string, unknown>;

// Thin progress bar filled to pct (0–100).
function progressBar(pct: number, color = LIME): FlexNode {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return {
    type: "box",
    layout: "vertical",
    height: "6px",
    backgroundColor: TRACK,
    cornerRadius: "3px",
    margin: "sm",
    contents:
      p > 0
        ? [
            {
              type: "box",
              layout: "vertical",
              width: `${p}%`,
              height: "6px",
              backgroundColor: color,
              cornerRadius: "3px",
              contents: [{ type: "filler" }],
            },
          ]
        : [{ type: "filler" }],
  };
}

const separator = (margin = "lg"): FlexNode => ({
  type: "separator",
  margin,
  color: TRACK,
});

export interface PlanTaskRow {
  title: string;
  done: boolean;
  startTime: string | null; // "HH:MM"
}

// ✅/⬜ · [start time] · title (struck through when done).
function taskRow(t: PlanTaskRow): FlexNode {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    margin: "md",
    contents: [
      { type: "text", text: t.done ? "✅" : "⬜", size: "sm", flex: 0 },
      ...(t.startTime
        ? [
            {
              type: "text",
              text: t.startTime,
              size: "sm",
              flex: 0,
              weight: "bold",
              color: t.done ? INK3 : OLIVE,
            },
          ]
        : []),
      {
        type: "text",
        text: t.title,
        size: "sm",
        flex: 1,
        wrap: true,
        color: t.done ? INK3 : INK,
        decoration: t.done ? "line-through" : "none",
      },
    ],
  };
}

export interface PlanCardPerson {
  name: string;
  /** Monthly goal progress 0–100, or null when no active goal is set. */
  goalPct: number | null;
}

/**
 * The FREE reply to /plan and /<name>plan. Leads with the month's goal
 * progress (own commission vs own active goal — same math as the dashboard
 * ring), then today's checklist with a done/total tally.
 */
export function personalPlanCard(
  person: PlanCardPerson,
  tasks: PlanTaskRow[],
  opts: { dateLabel: string; appUrl: string; onLeave: boolean }
) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const todayPct = total ? Math.round((done / total) * 100) : 0;
  const MAX_ROWS = 15;
  const shown = tasks.slice(0, MAX_ROWS);
  const overflow = total - shown.length;

  const todaySection: FlexNode[] = !total
    ? [
        {
          type: "text",
          text: opts.onLeave
            ? "🌴 วันนี้ลา — พักผ่อนให้เต็มที่"
            : "ยังไม่มีแผนวันนี้ — เพิ่มได้ที่หน้า แผนวันนี้",
          size: "sm",
          color: INK2,
          margin: "md",
          wrap: true,
        },
      ]
    : [
        ...(opts.onLeave
          ? [{ type: "text", text: "🌴 วันนี้ลา", size: "xs", color: INK3, margin: "sm" }]
          : []),
        ...shown.map(taskRow),
        ...(overflow > 0
          ? [
              {
                type: "text",
                text: `…และอีก ${overflow} งาน`,
                size: "xs",
                color: INK3,
                margin: "md",
              },
            ]
          : []),
      ];

  const bubble = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      backgroundColor: "#ffffff",
      contents: [
        // header — initial-avatar · name · date
        {
          type: "box",
          layout: "horizontal",
          alignItems: "center",
          spacing: "md",
          contents: [
            {
              type: "box",
              layout: "vertical",
              width: "44px",
              height: "44px",
              cornerRadius: "22px",
              backgroundColor: LIME_SOFT,
              justifyContent: "center",
              flex: 0,
              contents: [
                {
                  type: "text",
                  text: person.name.charAt(0).toUpperCase(),
                  align: "center",
                  weight: "bold",
                  size: "lg",
                  color: OLIVE,
                  // justifyContent only takes effect when every child of the
                  // box has flex: 0 (LINE flex-message-layout docs) — without
                  // this the initial isn't vertically centered in the circle.
                  flex: 0,
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                { type: "text", text: person.name, size: "lg", weight: "bold", color: INK },
                { type: "text", text: opts.dateLabel, size: "xs", color: INK3, margin: "xs" },
              ],
            },
          ],
        },
        // this month's goal progress (hidden without an active goal)
        ...(person.goalPct !== null
          ? [
              {
                type: "box",
                layout: "horizontal",
                margin: "lg",
                contents: [
                  {
                    type: "text",
                    text: "เป้าหมายเดือนนี้",
                    size: "xs",
                    color: INK2,
                    flex: 1,
                    gravity: "center",
                  },
                  {
                    type: "text",
                    text: `${person.goalPct}%`,
                    size: "xs",
                    weight: "bold",
                    color: OLIVE,
                    flex: 0,
                    align: "end",
                    gravity: "center",
                  },
                ],
              },
              progressBar(person.goalPct, person.goalPct >= 100 ? GOOD : LIME),
            ]
          : []),
        separator(),
        // today's plan heading + tally
        {
          type: "box",
          layout: "horizontal",
          alignItems: "center",
          margin: "lg",
          contents: [
            { type: "text", text: "แผนวันนี้", size: "md", weight: "bold", color: INK, flex: 1 },
            {
              type: "text",
              text: `${done}/${total} เสร็จ`,
              size: "xs",
              weight: "bold",
              color: total > 0 && done === total ? GOOD : INK2,
              flex: 0,
              align: "end",
              gravity: "center",
            },
          ],
        },
        progressBar(todayPct, todayPct >= 100 ? GOOD : LIME),
        ...todaySection,
        separator("xl"),
        // CTA — box-as-button: lime fill needs DARK text, and LINE's native
        // primary button forces white labels.
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          cornerRadius: "8px",
          backgroundColor: LIME,
          paddingAll: "10px",
          action: { type: "uri", label: "เปิด CRM", uri: opts.appUrl },
          contents: [
            {
              type: "text",
              text: `เปิด ${APP_NAME}`,
              align: "center",
              weight: "bold",
              size: "sm",
              color: ACCENT_INK,
            },
          ],
        },
      ],
    },
  };

  const altText = total
    ? `แผนวันนี้ของ ${person.name} — ${done}/${total} เสร็จ`
    : `${person.name} ยังไม่มีแผนวันนี้`;
  return { type: "flex", altText, contents: bubble };
}
