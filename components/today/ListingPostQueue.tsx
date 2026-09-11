// โพสต์เก่าเกิน SLA — the one queue that is not a phone call.
//
// Was one of three queues in SlaQueues until 2026-08-28, when the two FOLLOW
// queues (ตามเจ้าของทรัพย์ + ตาม Lead) merged into the ติดตามวันนี้ card that
// now sits above this one. This one stayed a table on purpose: its verb is
// different. Nobody is rung — a portal listing is refreshed — so neither of
// that card's two actions (log the call · put it on the plan) applies, and
// folding it in would have given the card a row type that behaves unlike its
// neighbours.
//
// GATED ON listingUpdateQueue, so sales never see it (Ben, 2026-08-28).
// Of the three SLA clocks this is the only one that is not a sales duty:
// ซัพพอร์ตประกาศ is defined as "โพสต์ประกาศให้เซลส์บนทุกแพลตฟอร์ม … และ
// ดันประกาศ" (lib/auth/roles.ts SEED_ROLE_META), and the permission matrix
// already says so — sales have listingUpdateQueue: false, which hides
// ดันประกาศ from their sidebar and bounces them off /reposts. A plan column
// headed "what do I do today" should not carry someone else's job. It stood
// on the sales dashboard from 2026-08-25 (as one of three SlaQueues cards)
// until Ben spotted the mismatch.
//
// The gate lives HERE rather than at the two call sites so a third caller
// cannot forget it, and it returns before the query so nobody pays for rows
// they may not see.
//
// NOTE: this does NOT make posting support-only. The ช่องทางการตลาด form on
// a listing page gates on listing SCOPE (`readOnly`), not on this permission,
// so a sales agent can still record a push on their OWN listing. That side
// door was left open on purpose — the person who did the push should be able
// to log it. Only the daily NAG is support's.
//
// Own server component so it does its own fetching: the queue is
// viewer-scoped and neither caller should have to thread the rows through.
//
// บันทึกกิจกรรม stayed on /today deliberately: that is data entry, not a
// dashboard surface.

import Link from "next/link";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkedRow,
  Pill,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getListingPostQueue } from "@/lib/repo/today";
import { mergedToneMap } from "@/lib/repo/options";
import { toneFor } from "@/lib/labels";
import { formatNum } from "@/lib/format";
import type { Viewer } from "@/lib/auth/session";

export async function ListingPostQueue({ viewer }: { viewer: Viewer }) {
  if (!viewer.perms.listingUpdateQueue) return null;

  const [listingPost, potentialTone] = await Promise.all([
    getListingPostQueue(viewer),
    mergedToneMap("listing_potential", "lead_potential"),
  ]);

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            โพสต์เก่าเกิน SLA
            {listingPost.total > 0 && (
              <Pill tone="bad">
                <span className="num">{formatNum(listingPost.total)}</span>
              </Pill>
            )}
          </span>
        }
      />
      {listingPost.rows.length === 0 ? (
        <EmptyState title="ไม่มีงานค้าง" hint="โพสต์ทุกรายการยังสดอยู่ในกรอบ SLA" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>ทรัพย์</Th>
                <Th>เกรด</Th>
                <Th>เกิน SLA</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {listingPost.rows.map((r) => (
                <LinkedRow key={r.id} href={`/listings/${r.id}`}>
                  <Td>
                    <Link href={`/listings/${r.id}`} className="block">
                      <div className="font-medium">
                        {r.listingName ?? r.legacyCode ?? "(ไม่มีชื่อ)"}
                      </div>
                      {r.legacyCode && (
                        <div className="num pt-0.5 text-xs text-ink-3">
                          {r.legacyCode}
                        </div>
                      )}
                    </Link>
                  </Td>
                  <Td>
                    {r.potential ? (
                      <Pill tone={toneFor(potentialTone, r.potential)}>
                        {r.potential}
                      </Pill>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Pill tone="bad">
                      เกิน <span className="num">{r.daysOver}</span> วัน
                    </Pill>
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/listings/${r.id}`}
                      className="text-xs text-accent-text hover:underline"
                    >
                      ไปอัปเดตช่องทาง →
                    </Link>
                  </Td>
                </LinkedRow>
              ))}
            </tbody>
          </Table>
          {listingPost.total > listingPost.rows.length && (
            <div className="px-5 py-3 text-xs text-ink-3">
              แสดง <span className="num">{listingPost.rows.length}</span> จาก{" "}
              <span className="num">{formatNum(listingPost.total)}</span> รายการ —
              เรียงตามที่เกิน SLA มากที่สุด
            </div>
          )}
        </>
      )}
    </Card>
  );
}
