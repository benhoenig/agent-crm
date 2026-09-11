import { Card, CardHeader, EmptyState } from "@/components/ui";
import { PostQueueRow } from "@/components/listings/PostQueueRow";
import { getDb } from "@/lib/db";
import { copyTemplates } from "@/lib/db/schema";
import { optionKeys, roleKeys, toneMap } from "@/lib/repo/options";
import { postQueue } from "@/lib/repo/post-queue";
import { missingFor, renderPost } from "@/lib/copy-render";
import { PLACEHOLDER_LABELS, type TemplateSet } from "@/lib/copy-templates";
import { bahtShort, bkkDate, daysSince, formatNum } from "@/lib/format";
import { toneFor } from "@/lib/labels";
import type { Viewer } from "@/lib/auth/session";
import type { PostQueueRow as QueueRow } from "@/lib/repo/post-queue";

/** "2 นอน · 2 น้ำ · 45 ตร.ม. · 4.2 ล้าน" — enough to tell two units in the
    same project apart at a glance, which is the whole risk on this list. */
function specLine(r: QueueRow): string {
  const price = r.source.askingPrice ?? r.source.rentalPrice;
  return [
    r.source.bed != null ? `${r.source.bed} นอน` : null,
    r.source.bath != null ? `${r.source.bath} น้ำ` : null,
    r.source.usableSqm ? `${formatNum(r.source.usableSqm)} ตร.ม.` : null,
    price ? bahtShort(Number(price)) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * รอโพสต์ — every listing sales has marked complete, waiting for support to
 * put it on the portals.
 *
 * THE TEMPLATES ARE FETCHED ONCE FOR THE WHOLE LIST, not per row. The drawer's
 * CopyStudio runs two queries every time it renders because it renders once;
 * here that would be two queries per listing for a list that exists to be
 * worked in bulk. renderPost is pure, so the fetch hoists cleanly.
 */
export async function PostQueue({ viewer }: { viewer: Viewer }) {
  const [rows, hotGrades, overrideRows, channelNames, potentialTone] =
    await Promise.all([
      postQueue(viewer),
      roleKeys("listing_potential", "hot"),
      getDb().select().from(copyTemplates),
      optionKeys("listing_channel"),
      toneMap("listing_potential"),
    ]);

  const overrides: Record<string, TemplateSet> = {};
  for (const o of overrideRows) overrides[`${o.listingType}|${o.tier}`] = o;

  return (
    <Card>
      <CardHeader
        title={`รอโพสต์ (${formatNum(rows.length)})`}
        action={
          <span className="text-xs text-ink-3">
            เรียงตามรอนานสุด — กดแถวเพื่อเอาข้อความโพสต์และวาง URL
          </span>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="ไม่มีทรัพย์รอโพสต์"
          hint="ทรัพย์จะขึ้นที่นี่เองเมื่อเซลส์เปลี่ยนสถานะเป็น “ข้อมูลครบ รอโพสต์”"
        />
      ) : (
        <div className="border-t border-line">
          {rows.map((r) => {
            const fb = renderPost(r.source, "normal", hotGrades, overrides);
            const dd = renderPost(r.source, "dd", hotGrades, overrides);
            return (
              <PostQueueRow
                key={r.id}
                id={r.id}
                title={r.listingName ?? r.legacyCode ?? "(ไม่มีชื่อ)"}
                code={r.listingName ? r.legacyCode : null}
                projectName={r.projectName}
                spec={specLine(r)}
                potential={r.potential}
                potentialTone={toneFor(potentialTone, r.potential)}
                agentName={r.agentName}
                waitingDays={
                  r.readySince ? daysSince(bkkDate(new Date(r.readySince))) : null
                }
                mediaCount={r.mediaCount}
                channels={r.channels}
                channelNames={channelNames}
                copies={[
                  { label: "Facebook / LINE", headline: fb.headline, body: fb.body },
                  {
                    label: "เว็บอสังหาฯ (DD/LV/PH)",
                    headline: dd.headline,
                    body: dd.body,
                  },
                ]}
                missing={missingFor(r.source, hotGrades, overrides).map(
                  (m) => PLACEHOLDER_LABELS[m] ?? m
                )}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
