/* Template rendering — deterministic, no AI. Ported from the Klaichan/Mook
   CRM (proven against a real book of thin listings). Fills <Field>
   placeholders from a listing and DROPS what isn't known.

   Dropping matters more than filling: many listings have no ตึก, no วิว, no
   ทิศ. Naive substitution ships posts reading "🧡 ตึก" with nothing after
   it. So a line is pruned segment by segment — "ทิศเหนือ วิวเมือง" keeps
   whichever half is known and disappears entirely when neither is. */

import {
  POST_TEMPLATES,
  type CopyChannel,
  type CopyTier,
  type TemplateSet,
} from "./copy-templates";

/** The listing slice the renderer needs (assembled by the listing page). */
export interface CopySource {
  legacyCode: string | null;
  listingType: string | null;
  potential: string | null;
  projectEng: string | null;
  projectThai: string | null;
  zoneName: string | null;
  postRemark: string | null;
  bed: number | null;
  bath: number | null;
  usableSqm: string | null;
  floor: string | null;
  building: string | null;
  parking: string | null;
  direction: string | null;
  view: string | null;
  askingPrice: string | null;
  rentalPrice: string | null;
  priceRemark: string | null;
}

/** Grade → tier. Which grades count as premium is the client's call: it
    reads the "hot" role off the grade list (Exclusive and A carry it out of
    the box) rather than naming grades here. A new grade gets the low tier
    until marked hot in Settings — the safe default. */
export function tierFor(hotGrades: string[], potential: string | null): CopyTier {
  return potential && hotGrades.includes(potential) ? "high" : "low";
}

/** Where a rendered post's text came from.
    - edited   — a copy_templates row for this exact (type × tier)
    - default  — no row, but this type ships a template of its own
    - borrowed — no row and no template of its own, so it resolves to Sale's.
                 Renders fine and means nothing; Settings → เทมเพลตโพสต์
                 exists largely to make this state visible. */
export type TemplateOrigin = "edited" | "default" | "borrowed";

export interface TemplateResolution {
  template: TemplateSet;
  origin: TemplateOrigin;
  /** What this cell would render from if its override were deleted. Needed by
      the Settings editor, which has to say where "คืนค่าเริ่มต้น" lands. */
  fallbackOrigin: Exclude<TemplateOrigin, "edited">;
  /** For fallbackOrigin "borrowed": the type whose text stands in. */
  fallbackFrom: string | null;
  /** An override exists but its text is byte-identical to what would render
      without it. Two very different meanings, told apart by fallbackOrigin:
      on a "default" cell the row is redundant; on a "borrowed" one it is the
      whole point — the type has stopped tracking Sale even though the words
      have not changed yet. Settings labels them differently because of it. */
  sameAsFallback: boolean;
}

const sameText = (a: TemplateSet, b: TemplateSet) =>
  a.headline === b.headline && a.normal === b.normal && a.dd === b.dd;

/** THE resolver. Overrides (Settings edits, keyed "Sale|high") win over the
    code defaults; the fallback-to-Sale happens BEFORE the override lookup so
    an edited Sale template also covers a type with no template of its own.

    Settings reads this too rather than reimplementing the rules — a settings
    page that disagreed with the renderer it configures would be worse than
    one with no status labels at all. */
export function resolveTemplate(
  type: string | null,
  tier: CopyTier,
  overrides?: Record<string, TemplateSet>
): TemplateResolution {
  const own = `${type}|${tier}`;
  const hasOwn = own in POST_TEMPLATES;
  const fallbackOrigin = hasOwn ? ("default" as const) : ("borrowed" as const);
  const fallbackFrom = hasOwn ? null : "Sale";

  // What this cell renders from with its own override taken away. For a
  // borrowing type that is Sale's EDITED text when the client has edited Sale
  // — not the words that shipped in the box.
  const fallback = hasOwn
    ? POST_TEMPLATES[own]
    : (overrides?.[`Sale|${tier}`] ?? POST_TEMPLATES[`Sale|${tier}`]);

  const edited = overrides?.[own];
  if (edited)
    return {
      template: edited,
      origin: "edited",
      fallbackOrigin,
      fallbackFrom,
      sameAsFallback: sameText(edited, fallback),
    };
  return {
    template: fallback,
    origin: fallbackOrigin,
    fallbackOrigin,
    fallbackFrom,
    sameAsFallback: true,
  };
}

export function templateFor(
  hotGrades: string[],
  type: string | null,
  potential: string | null,
  overrides?: Record<string, TemplateSet>
): TemplateSet {
  return resolveTemplate(type, tierFor(hotGrades, potential), overrides)
    .template;
}

const money = (v: string | null) => {
  if (v == null) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : v;
};
const numOrEmpty = (n: number | null) => (n == null ? "" : String(n));

/** The template already writes "วิว" / "ทิศ" before the value, but some
    listings store "วิวเมือง" in the field itself — strip the repeat so the
    post doesn't read "วิววิวเมือง". */
const dedupePrefix = (v: string | null, prefix: string) => {
  const s = (v ?? "").trim();
  return s.startsWith(prefix) ? s.slice(prefix.length).trim() : s;
};

/** Placeholder name → value for this listing. */
export function valuesFor(l: CopySource): Record<string, string> {
  return {
    "Post Remark": l.postRemark ?? "",
    "Project Name (Eng)": l.projectEng ?? "",
    "Project Name (Thai)": l.projectThai ?? "",
    "Listing ID": l.legacyCode ?? "",
    "Bed": numOrEmpty(l.bed),
    "Bath": numOrEmpty(l.bath),
    "Sqm.": l.usableSqm ? money(l.usableSqm) : "",
    "Floor": l.floor ?? "",
    "Building": l.building ?? "",
    "Parking": l.parking ?? "",
    "Direction": dedupePrefix(l.direction, "ทิศ"),
    "View": dedupePrefix(l.view, "วิว"),
    "Zone": l.zoneName ?? "",
    "Asking Price": money(l.askingPrice),
    "Rental Price": money(l.rentalPrice),
    "Price Remark": l.priceRemark ?? "",
  };
}

const PLACEHOLDER = /<([^>]+)>/g;

/** Split a line into independently-droppable segments.
    Boundaries: " | " (hook vs label), " / " (bed/bath), and the space
    between two placeholder groups (ทิศ<Direction> วิว<View>). Everything
    else stays glued to its placeholder, so "ชั้น <Floor>" lives or dies as
    a unit. The " | " case is load-bearing: without it an empty <Post
    Remark> takes the whole headline down with it. */
function segments(line: string): { text: string; sep: string }[] {
  const parts: { text: string; sep: string }[] = [];
  const re = / \| | \/ |(?<=>)\s+(?=[^<\s]*<)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    parts.push({ text: line.slice(last, m.index), sep: m[0] });
    last = m.index + m[0].length;
  }
  parts.push({ text: line.slice(last), sep: "" });
  return parts;
}

function renderLine(
  line: string,
  values: Record<string, string>
): string | null {
  if (!PLACEHOLDER.test(line)) {
    PLACEHOLDER.lastIndex = 0;
    return line;
  }
  PLACEHOLDER.lastIndex = 0;

  // The bullet ("🧡 ") belongs to the LINE, not its first segment — otherwise
  // dropping an empty ทิศ leaves a bare "วิวเมือง" with no bullet.
  const bullet = line.match(/^([^\p{L}\p{N}<]*)/u)?.[1] ?? "";
  const rest = line.slice(bullet.length);

  // A survivor is prefixed by the separator of whatever preceded it in the
  // ORIGINAL line, so a dropped middle segment still leaves its structural
  // marker while a dropped leading segment leaves nothing.
  const segs = segments(rest);
  let out = bullet;
  let first = true;
  segs.forEach((seg, i) => {
    const names = [...seg.text.matchAll(/<([^>]+)>/g)].map((m) => m[1]);
    // a segment survives only if every placeholder in it has a value
    if (names.length && !names.every((n) => (values[n] ?? "").trim() !== ""))
      return;
    const text = seg.text.replace(/<([^>]+)>/g, (_, n) => values[n] ?? "").trim();
    if (text === "") return;
    out += (first ? "" : (segs[i - 1]?.sep ?? " ")) + text;
    first = false;
  });

  if (first) return null;
  out = out.trimEnd();
  return /[\p{L}\p{N}]/u.test(out) ? out : null;
}

/** Fill a template, dropping unknown fields. Collapses the blank runs that
    pruning leaves behind so the post never has a 3-line gap. */
export function renderTemplate(
  template: string,
  values: Record<string, string>
): string {
  const lines = template.split("\n").map((l) => renderLine(l, values));
  const out: string[] = [];
  for (const line of lines) {
    if (line === null) continue;
    if (line.trim() === "" && out.length > 0 && out[out.length - 1].trim() === "")
      continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface RenderedPost {
  headline: string;
  body: string;
}

/** The finished post for one channel. */
export function renderPost(
  l: CopySource,
  channel: CopyChannel,
  hotGrades: string[],
  overrides?: Record<string, TemplateSet>
): RenderedPost {
  const tpl = templateFor(hotGrades, l.listingType, l.potential, overrides);
  const values = valuesFor(l);
  return {
    headline: renderTemplate(tpl.headline, values),
    body: renderTemplate(channel === "dd" ? tpl.dd : tpl.normal, values),
  };
}

/** Fields the template wants but this listing hasn't got — shown in the UI
    so what to fill in is visible before a thin post ships. */
export function missingFor(
  l: CopySource,
  hotGrades: string[],
  overrides?: Record<string, TemplateSet>
): string[] {
  const tpl = templateFor(hotGrades, l.listingType, l.potential, overrides);
  const values = valuesFor(l);
  const wanted = new Set<string>();
  for (const t of [tpl.headline, tpl.normal, tpl.dd])
    for (const m of t.matchAll(/<([^>]+)>/g)) wanted.add(m[1]);
  return [...wanted].filter((n) => (values[n] ?? "").trim() === "");
}
