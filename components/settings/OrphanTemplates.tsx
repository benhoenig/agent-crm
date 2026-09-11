"use client";

// Templates left behind by a listing type that no longer exists in the
// picklist. lib/copy-render.ts keys on the type's text, so nothing can ever
// reach these again — and while they sit there they block renaming another
// type onto that name (copy_templates is PK'd on (listing_type, tier)).
//
// Deleting is the only thing to do with one, but it is still someone's
// written copy, so it goes through the same confirm as everything else.

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import type { TemplateOrphan } from "@/lib/repo/copy-templates";
import { deleteOrphanTemplate } from "@/app/(app)/settings/templates/actions";

const TIER_LABEL = { high: "เกรดพรีเมียม", low: "เกรดทั่วไป" } as const;

export function OrphanTemplates({ orphans }: { orphans: TemplateOrphan[] }) {
  const [, startTransition] = React.useTransition();

  function remove(o: TemplateOrphan) {
    startTransition(async () => {
      await deleteOrphanTemplate(o.listingType, o.tier);
    });
  }

  return (
    <Card>
      <CardHeader title="เทมเพลตที่ไม่มีเจ้าของแล้ว" />
      <p className="flex items-start gap-2 px-5 pb-3 text-xs leading-relaxed text-warn">
        <AlertTriangle size={14} className="mt-px shrink-0" />
        <span>
          ประเภทการขายเหล่านี้ถูกลบหรือเปลี่ยนชื่อไปแล้ว เทมเพลตจึงไม่ถูกใช้กับทรัพย์ใดเลย
          และยังกันไม่ให้เปลี่ยนชื่อประเภทอื่นมาเป็นชื่อนี้ด้วย
        </span>
      </p>
      <ul className="divide-y divide-line border-t border-line">
        {orphans.map((o) => (
          <li
            key={`${o.listingType}|${o.tier}`}
            className="flex items-center justify-between gap-3 px-5 py-3"
          >
            <span className="text-sm">
              {o.listingType}
              <span className="pl-2 text-xs text-ink-3">
                {TIER_LABEL[o.tier]}
              </span>
            </span>
            <ConfirmDelete
              onConfirm={() => remove(o)}
              actionLabel="ลบเทมเพลต"
              confirmLabel={`ลบเทมเพลตของ “${o.listingType}”?`}
              warning="ไม่มีทรัพย์ไหนใช้เทมเพลตนี้แล้ว ข้อความที่เขียนไว้จะหายถาวร"
              triggerAriaLabel={`ลบเทมเพลตของ ${o.listingType}`}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
