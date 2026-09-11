import { Card, CardHeader, Pill } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { getDb } from "@/lib/db";
import { copyTemplates } from "@/lib/db/schema";
import { roleKeys } from "@/lib/repo/options";
import {
  missingFor,
  renderPost,
  type CopySource,
} from "@/lib/copy-render";
import {
  PLACEHOLDER_LABELS,
  type TemplateSet,
} from "@/lib/copy-templates";

/** โพสต์ประกาศ — the deterministic copy generator on the listing sheet.
    Server component: renders both channel variants ready to copy, and names
    the fields the template wanted but the listing hasn't got. */
export async function CopyStudio({ source }: { source: CopySource }) {
  const [hotGrades, overrideRows] = await Promise.all([
    roleKeys("listing_potential", "hot"),
    getDb().select().from(copyTemplates),
  ]);
  const overrides: Record<string, TemplateSet> = {};
  for (const o of overrideRows) overrides[`${o.listingType}|${o.tier}`] = o;

  const fb = renderPost(source, "normal", hotGrades, overrides);
  const dd = renderPost(source, "dd", hotGrades, overrides);
  const missing = missingFor(source, hotGrades, overrides);

  return (
    <Card>
      <CardHeader
        title="โพสต์ประกาศ"
        action={
          <span className="text-xs text-ink-3">
            สร้างจากเทมเพลต (ตั้งค่า → เทมเพลตโพสต์) — ช่องที่ไม่มีข้อมูลถูกตัดออกให้เอง
          </span>
        }
      />
      <div className="space-y-4 px-5 pb-5">
        {missing.length > 0 ? (
          <p className="rounded-ctl bg-warn-soft px-3 py-2 text-xs text-warn">
            ยังไม่ได้กรอก: {missing.map((m) => PLACEHOLDER_LABELS[m] ?? m).join(" · ")}
            {" "}— โพสต์จะสั้นกว่าที่ควร
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {[
            { label: "Facebook / LINE", post: fb },
            { label: "เว็บอสังหาฯ (DD/LV/PH)", post: dd },
          ].map(({ label, post }) => (
            <div key={label} className="space-y-2">
              <div className="flex items-center justify-between">
                <Pill tone="muted">{label}</Pill>
                <CopyButton
                  text={`${post.headline}\n\n${post.body}`}
                  label="คัดลอกโพสต์"
                />
              </div>
              <div className="rounded-ctl border border-line bg-surface-2 p-3">
                <p className="text-sm font-semibold">{post.headline}</p>
                <pre className="whitespace-pre-wrap pt-2 font-sans text-xs leading-relaxed text-ink-2">
                  {post.body}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
