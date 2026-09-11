/* Settings → เทมเพลตโพสต์ — the template matrix.

   Same lesson as the repost cadence one tab over. The old editor showed the
   four templates that exist in lib/copy-templates.ts, and the client's book
   does not look like that: there are five listing types, and two of them
   (Sale with Tenant, Sale & Rent — 631 listings between them) have no
   template at all. Those listings render through templateFor()'s
   `Sale|tier` fallback, which the old page could not show and its
   assertCombo() would not let anyone edit. The price block survives (the Sale
   default carries both ขาย and เช่า lines and prunes the one that is empty),
   but the headline and the lead line say only "ขายคอนโด" — so 631 listings
   are advertised in words nobody picked for them, and 172 of them are for
   rent as well as for sale without ever saying so.

   So the editor is a matrix over the LIVE listing_type options × tier, and
   every cell states where its text actually comes from — the client's own
   edit, this type's code default, or another type's default it is borrowing.

   The previews are built from REAL listings, two per type: the row with the
   most template fields filled and the row with the fewest. Pruning is the
   hardest thing about this template language (lib/copy-render.ts drops a
   segment whose placeholders are empty), and the only honest way to show it
   is on the client's own thinnest listing.                                */

import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { copyTemplates } from "@/lib/db/schema";
import { allOptions, roleKeys } from "@/lib/repo/options";
import { type CopyTier, type TemplateSet } from "@/lib/copy-templates";
import {
  resolveTemplate,
  tierFor,
  type CopySource,
  type TemplateOrigin,
} from "@/lib/copy-render";

export const TIERS: CopyTier[] = ["high", "low"];

export type { TemplateOrigin };

export interface TemplateCell {
  listingType: string;
  tier: CopyTier;
  /** What a post for this cell is rendered from right now. */
  template: TemplateSet;
  origin: TemplateOrigin;
  /** What this cell would fall back to if its override were deleted —
      computed even when there IS no override, because "คืนค่าเริ่มต้น" has to
      state where the text goes, and for a borrowing type that is not the
      shipped default but another type's copy. */
  fallbackOrigin: Exclude<TemplateOrigin, "edited">;
  /** For fallbackOrigin "borrowed": the listing type standing in. */
  fallbackFrom: string | null;
  /** Override exists but reads exactly like the fallback. */
  sameAsFallback: boolean;
  /** Listings of this type whose grade puts them in this tier. */
  listings: number;
}

export interface TemplateSample extends CopySource {
  id: string;
  /** "rich" = most template fields filled, "thin" = fewest. */
  pick: "rich" | "thin";
  filled: number;
}

export interface TemplateType {
  key: string;
  archived: boolean;
  /** All listings of this type, both tiers. */
  listings: number;
  cells: TemplateCell[];
  samples: TemplateSample[];
}

/** An override row whose listing type is no longer in the picklist. It can
    never be reached by templateFor() again — only deleted. */
export interface TemplateOrphan {
  listingType: string;
  tier: CopyTier;
  updatedAt: Date;
}

export interface TemplateMatrix {
  types: TemplateType[];
  orphans: TemplateOrphan[];
  /** Grades tagged "hot" — what puts a listing in the premium tier. */
  hotGrades: string[];
  /** Listings whose type is empty: they resolve to the Sale fallback with no
      type row of their own to edit. Worth naming rather than hiding. */
  typeless: number;
}

/** Per (type, tier) listing counts, bucketed by the hot-grade role rather
    than by grade name — same rule tierFor() applies at render time. */
async function tierCounts(hotGrades: string[]) {
  const { rows } = await getDb().execute<{
    listing_type: string | null;
    potential: string | null;
    n: number;
  }>(
    sql`select listing_type, potential, count(*)::int as n
        from listings group by 1, 2`
  );
  const byCell = new Map<string, number>();
  const byType = new Map<string, number>();
  let typeless = 0;
  for (const r of rows) {
    if (!r.listing_type) {
      typeless += r.n;
      continue;
    }
    const tier = tierFor(hotGrades, r.potential);
    const k = `${r.listing_type}|${tier}`;
    byCell.set(k, (byCell.get(k) ?? 0) + r.n);
    byType.set(r.listing_type, (byType.get(r.listing_type) ?? 0) + r.n);
  }
  return { byCell, byType, typeless };
}

/** Two real listings per type — the best-filled and the worst-filled. The
    `filled` score counts exactly the placeholders lib/copy-render.ts fills,
    so "thin" really is the listing that prunes hardest. */
async function sampleListings(): Promise<Map<string, TemplateSample[]>> {
  const { rows } = await getDb().execute<{
    id: string;
    listing_type: string;
    pick: "rich" | "thin";
    filled: number;
    legacy_code: string | null;
    potential: string | null;
    project_eng: string | null;
    project_thai: string | null;
    zone_name: string | null;
    post_remark: string | null;
    bed: number | null;
    bath: number | null;
    usable_sqm: string | null;
    floor: string | null;
    building: string | null;
    parking: string | null;
    direction: string | null;
    view: string | null;
    asking_price: string | null;
    rental_price: string | null;
    price_remark: string | null;
  }>(sql`
    with src as (
      select
        l.id::text                      as id,
        l.listing_type                  as listing_type,
        l.legacy_code                   as legacy_code,
        l.potential                     as potential,
        p.name_eng                      as project_eng,
        p.name_thai                     as project_thai,
        coalesce(z.name_thai, z.name_eng) as zone_name,
        l.post_remark                   as post_remark,
        l.bed                           as bed,
        l.bath                          as bath,
        l.usable_sqm::text              as usable_sqm,
        l.floor                         as floor,
        l.building                      as building,
        l.parking                       as parking,
        l.direction                     as direction,
        l."view"                        as view,
        l.asking_price::text            as asking_price,
        l.rental_price::text            as rental_price,
        l.price_remark                  as price_remark,
        (
          (l.post_remark is not null and l.post_remark <> '')::int +
          (p.name_eng    is not null and p.name_eng    <> '')::int +
          (p.name_thai   is not null and p.name_thai   <> '')::int +
          (l.legacy_code is not null and l.legacy_code <> '')::int +
          (l.bed is not null)::int + (l.bath is not null)::int +
          (l.usable_sqm is not null)::int +
          (l.floor    is not null and l.floor    <> '')::int +
          (l.building is not null and l.building <> '')::int +
          (l.parking  is not null and l.parking  <> '')::int +
          (l.direction is not null and l.direction <> '')::int +
          (l."view"    is not null and l."view"    <> '')::int +
          (coalesce(z.name_thai, z.name_eng) is not null)::int +
          (l.asking_price is not null)::int +
          (l.rental_price is not null)::int +
          (l.price_remark is not null and l.price_remark <> '')::int
        ) as filled
      from listings l
      left join projects p on p.id = l.project_id
      left join zones    z on z.id = l.zone_id
      where l.listing_type is not null
    )
    (select distinct on (listing_type) *, 'rich' as pick from src
       order by listing_type, filled desc, legacy_code)
    union all
    (select distinct on (listing_type) *, 'thin' as pick from src
       order by listing_type, filled asc, legacy_code)
  `);

  const map = new Map<string, TemplateSample[]>();
  for (const r of rows) {
    const sample: TemplateSample = {
      id: r.id,
      pick: r.pick,
      filled: Number(r.filled),
      legacyCode: r.legacy_code,
      listingType: r.listing_type,
      potential: r.potential,
      projectEng: r.project_eng,
      projectThai: r.project_thai,
      zoneName: r.zone_name,
      postRemark: r.post_remark,
      bed: r.bed == null ? null : Number(r.bed),
      bath: r.bath == null ? null : Number(r.bath),
      usableSqm: r.usable_sqm,
      floor: r.floor,
      building: r.building,
      parking: r.parking,
      direction: r.direction,
      view: r.view,
      askingPrice: r.asking_price,
      rentalPrice: r.rental_price,
      priceRemark: r.price_remark,
    };
    const list = map.get(r.listing_type) ?? [];
    list.push(sample);
    map.set(r.listing_type, list);
  }
  // rich first, and drop the duplicate when a type has only one listing
  for (const [k, list] of map) {
    list.sort((a, b) => b.filled - a.filled);
    map.set(k, list[0]?.id === list[1]?.id ? [list[0]] : list);
  }
  return map;
}

export async function getTemplateMatrix(): Promise<TemplateMatrix> {
  const [rows, opts, hotGrades, samples] = await Promise.all([
    getDb().select().from(copyTemplates),
    allOptions(),
    roleKeys("listing_potential", "hot"),
    sampleListings(),
  ]);
  const counts = await tierCounts(hotGrades);

  const overrides: Record<string, TemplateSet> = {};
  for (const r of rows) overrides[`${r.listingType}|${r.tier}`] = r;

  const typeOptions = opts.filter((o) => o.kind === "listing_type");
  const known = new Set(typeOptions.map((o) => o.key));

  const types: TemplateType[] = [];
  for (const o of typeOptions) {
    const listings = counts.byType.get(o.key) ?? 0;
    // An archived type with no listings and no edited template is finished
    // business — leaving it on the page is noise.
    const hasEdit = TIERS.some((t) => `${o.key}|${t}` in overrides);
    if (o.archived && listings === 0 && !hasEdit) continue;
    types.push({
      key: o.key,
      archived: o.archived,
      listings,
      cells: TIERS.map((tier) => ({
        listingType: o.key,
        tier,
        listings: counts.byCell.get(`${o.key}|${tier}`) ?? 0,
        // the renderer's own resolver, not a copy of its rules
        ...resolveTemplate(o.key, tier, overrides),
      })),
      samples: samples.get(o.key) ?? [],
    });
  }

  const orphans: TemplateOrphan[] = rows
    .filter((r) => !known.has(r.listingType))
    .map((r) => ({
      listingType: r.listingType,
      tier: r.tier,
      updatedAt: r.updatedAt,
    }));

  return { types, orphans, hotGrades, typeless: counts.typeless };
}
