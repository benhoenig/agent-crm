"use server";

// เทมเพลตโพสต์ tab mutations. Admin-gated (p.settings), re-checked here
// because a server action is its own entry point.
//
// A row in copy_templates is an OVERRIDE: only edited (type × tier) combos
// have one, and lib/copy-render.ts falls back to the code defaults otherwise.
// Two consequences the actions have to honour:
//
//  1. Saving ONE field has to materialise the other two from whatever is
//     rendering today, or the first blur would blank the two fields the
//     admin hasn't touched yet.
//  2. A type with no default of its own (Sale with Tenant, Sale & Rent, and
//     anything the client adds later) borrows the Sale text. That is a
//     resolvable state, not an error — so every live listing_type is
//     editable. The old assertCombo() refused exactly the combos that most
//     needed fixing.
//
// Unknown placeholders are rejected rather than saved. A typo like <Bedd>
// has no value, so the renderer prunes the whole segment it sits in and the
// line disappears from every post — silently, at render time, on the client's
// listings. Naming it here is the only place it can still be cheap.

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { copyTemplates } from "@/lib/db/schema";
import { getViewer, requirePermission } from "@/lib/auth/session";
import { allKeys } from "@/lib/repo/options";
import {
  PLACEHOLDER_LABELS,
  type CopyTier,
  type TemplateSet,
} from "@/lib/copy-templates";
import { resolveTemplate } from "@/lib/copy-render";

export type TemplateActionResult = { ok: true } | { ok: false; error: string };

/** Reset also hands back the text the cell now renders from, so the editor
    can put it in the box without a second round trip — the textareas are
    controlled by local draft state and would otherwise still be showing the
    copy that was just discarded. */
export type TemplateResetResult =
  | { ok: true; template: TemplateSet }
  | { ok: false; error: string };

export type TemplateField = "headline" | "normal" | "dd";

const FIELD_LABEL: Record<TemplateField, string> = {
  headline: "หัวข้อโพสต์",
  normal: "เนื้อหา Facebook / LINE",
  dd: "เนื้อหาเว็บอสังหาฯ",
};

/** Generous — a portal body with a long ติดต่อ block is legitimately large,
    and the point of the cap is to stop a paste accident, not to shape copy. */
const MAX_LEN = 6000;

const TIERS: CopyTier[] = ["high", "low"];

function refresh() {
  revalidatePath("/settings/templates");
  // every listing sheet renders its post from these
  revalidatePath("/listings", "layout");
}

/** The text this cell renders from right now. Goes through the renderer's own
    resolver rather than reimplementing it: for a type with no template of its
    own the answer is the client's EDITED Sale copy when there is one, not the
    text that shipped in the box — materialising the wrong one would silently
    rewrite the type's voice at the moment of adoption. */
async function effective(
  listingType: string,
  tier: CopyTier
): Promise<TemplateSet> {
  const rows = await getDb().select().from(copyTemplates);
  const overrides: Record<string, TemplateSet> = {};
  for (const r of rows) overrides[`${r.listingType}|${r.tier}`] = r;
  return resolveTemplate(listingType, tier, overrides).template;
}

function badPlaceholders(text: string): string[] {
  const bad = new Set<string>();
  for (const m of text.matchAll(/<([^>]*)>/g)) {
    if (!(m[1] in PLACEHOLDER_LABELS)) bad.add(m[1]);
  }
  return [...bad];
}

/** Discriminated on purpose: CopyTier IS a string, so a `CopyTier | string`
    return would make every caller's "is it an error?" check unwriteable. */
type Validated = { tier: CopyTier } | { error: string };

async function validate(
  listingType: string,
  tier: string
): Promise<Validated> {
  if (!TIERS.includes(tier as CopyTier)) return { error: "เทียร์ไม่ถูกต้อง" };
  // Archived accepted: a hidden type can still be sitting on live listings,
  // and those listings still generate posts.
  const types = await allKeys("listing_type");
  if (!types.includes(listingType))
    return { error: `ไม่มีประเภทการขาย “${listingType}” ในรายการตัวเลือกแล้ว` };
  return { tier: tier as CopyTier };
}

/** Save one field of one (type × tier). The other two fields are written
    from what is rendering today, so the first edit of a borrowed cell turns
    it into a real template instead of a half-blank one. */
export async function setTemplateField(
  listingType: string,
  tierIn: string,
  field: TemplateField,
  value: string
): Promise<TemplateActionResult> {
  await requirePermission((p) => p.settings);
  const v = await validate(listingType, tierIn);
  if ("error" in v) return { ok: false, error: v.error };
  const tier = v.tier;
  if (!(field in FIELD_LABEL)) return { ok: false, error: "ช่องไม่ถูกต้อง" };

  const text = value.replace(/\r\n/g, "\n");
  if (text.length > MAX_LEN)
    return {
      ok: false,
      error: `${FIELD_LABEL[field]} ยาวเกิน ${MAX_LEN.toLocaleString()} ตัวอักษร`,
    };
  const bad = badPlaceholders(text);
  if (bad.length > 0)
    return {
      ok: false,
      error: `ไม่รู้จักช่อง ${bad
        .map((b) => `<${b}>`)
        .join(" · ")} — ระบบจะตัดบรรทัดนั้นทิ้งทั้งบรรทัด ใช้ได้เฉพาะช่องที่อยู่ในรายการด้านบน`,
    };
  if (text.trim() === "")
    return {
      ok: false,
      error: `${FIELD_LABEL[field]} ว่างไม่ได้ — ถ้าจะกลับไปใช้ค่าเริ่มต้น กด “คืนค่าเริ่มต้น”`,
    };

  const viewer = await getViewer();
  const base = await effective(listingType, tier);

  await getDb()
    .insert(copyTemplates)
    .values({
      listingType,
      tier,
      headline: base.headline,
      normal: base.normal,
      dd: base.dd,
      [field]: text,
      updatedBy: viewer.userId,
    })
    .onConflictDoUpdate({
      target: [copyTemplates.listingType, copyTemplates.tier],
      set: { [field]: text, updatedBy: viewer.userId },
    });

  refresh();
  return { ok: true };
}

/** Turn a borrowed cell into a template of its own without editing anything
    — copies the text that is already rendering. The point is not the text
    (identical), it is that the type stops silently tracking Sale: a later
    change to the Sale template no longer moves this type's posts. */
export async function adoptTemplate(
  listingType: string,
  tierIn: string
): Promise<TemplateActionResult> {
  await requirePermission((p) => p.settings);
  const v = await validate(listingType, tierIn);
  if ("error" in v) return { ok: false, error: v.error };
  const tier = v.tier;

  const viewer = await getViewer();
  const base = await effective(listingType, tier);
  await getDb()
    .insert(copyTemplates)
    .values({
      listingType,
      tier,
      headline: base.headline,
      normal: base.normal,
      dd: base.dd,
      updatedBy: viewer.userId,
    })
    .onConflictDoNothing({
      target: [copyTemplates.listingType, copyTemplates.tier],
    });

  refresh();
  return { ok: true };
}

/** Discard the override. The cell goes back to whatever the code renders —
    which for a type with no default of its own means back to borrowing Sale.
    Destructive: the written copy is gone, so the UI confirms first. */
export async function resetTemplate(
  listingType: string,
  tierIn: string
): Promise<TemplateResetResult> {
  await requirePermission((p) => p.settings);
  const v = await validate(listingType, tierIn);
  if ("error" in v) return { ok: false, error: v.error };
  const tier = v.tier;

  await getDb()
    .delete(copyTemplates)
    .where(
      and(
        eq(copyTemplates.listingType, listingType),
        eq(copyTemplates.tier, tier)
      )
    );
  refresh();
  // recomputed AFTER the delete, so it is what the cell now falls back to
  return { ok: true, template: await effective(listingType, tier) };
}

/** Remove an override whose listing type is no longer in the picklist.
    Deleting is all that can be done with it — templateFor() can never reach
    it again, and it blocks renaming another type onto that name (the table's
    primary key is (listing_type, tier)). Deliberately NOT validated against
    the picklist: the whole point is that the type is gone. */
export async function deleteOrphanTemplate(
  listingType: string,
  tierIn: string
): Promise<TemplateActionResult> {
  await requirePermission((p) => p.settings);
  if (!TIERS.includes(tierIn as CopyTier))
    return { ok: false, error: "เทียร์ไม่ถูกต้อง" };

  await getDb()
    .delete(copyTemplates)
    .where(
      and(
        eq(copyTemplates.listingType, listingType),
        eq(copyTemplates.tier, tierIn as CopyTier)
      )
    );
  refresh();
  return { ok: true };
}
