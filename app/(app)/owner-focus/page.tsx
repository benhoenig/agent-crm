/* โฟกัสเจ้าของ — the board an agent works, grouped by owner (Ben, 2026-09-11).
   Schema reasoning in lib/db/schema/property.ts listingFocus; grouping and
   ordering in lib/repo/focus.ts focusBoard. */

import Link from "next/link";
import { Phone, Star } from "lucide-react";
import {
  Card,
  EmptyState,
  PageHeader,
  Pill,
  type Tone,
} from "@/components/ui";
import { FocusStar } from "@/components/listings/FocusStar";
import { getViewer } from "@/lib/auth/session";
import { focusBoard, focusCounts, type FocusOwner } from "@/lib/repo/focus";
import { toneMaps } from "@/lib/repo/options";
import { bahtShort, daysAgoLabel, formatNum } from "@/lib/format";
import { param, type Search } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const viewer = await getViewer();

  /* WHOSE BOARD. The param is honoured only for focusDirectory holders, and
     the check is here rather than in the repo because "may I read someone
     else's" is a question about this PAGE — focusBoard itself takes an agent
     id and answers honestly, which is what makes it reusable. Anyone else
     gets their own board no matter what they put in the URL. */
  const requested = param(sp, "agent");
  const canBrowse = viewer.perms.focusDirectory;
  const agentId = canBrowse && requested ? requested : viewer.userId;
  const isOwnBoard = agentId === viewer.userId;

  const [board, counts, tones] = await Promise.all([
    focusBoard(agentId),
    canBrowse ? focusCounts() : Promise.resolve([]),
    toneMaps("listing_status", "listing_potential"),
  ]);

  const totalListings = board.reduce((n, o) => n + o.listings.length, 0);
  const viewing = counts.find((c) => c.userId === agentId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="โฟกัสเจ้าของ"
        sub={
          totalListings
            ? `${formatNum(totalListings)} ทรัพย์ · ${formatNum(board.length)} เจ้าของ`
            : "ทรัพย์ที่กำลังตามอยู่"
        }
      />

      {/* The manager's read (focusDirectory). Rendered as plain links rather
          than a <select> so the current board is a URL somebody can send. */}
      {canBrowse && counts.length > 0 && (
        <Card className="flex flex-wrap items-center gap-1.5 p-3">
          <span className="pr-1 text-[0.7rem] text-ink-3">ดูของ</span>
          <Link
            href="/owner-focus"
            className={`rounded-full px-2.5 py-1 text-[0.75rem] font-semibold transition-colors ${
              isOwnBoard
                ? "bg-accent text-accent-ink"
                : "text-ink-2 hover:bg-surface-2"
            }`}
          >
            ของฉัน
          </Link>
          {counts
            .filter((c) => c.userId !== viewer.userId)
            .map((c) => (
              <Link
                key={c.userId}
                href={`/owner-focus?agent=${c.userId}`}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] transition-colors ${
                  c.userId === agentId
                    ? "bg-accent text-accent-ink"
                    : "text-ink-2 hover:bg-surface-2"
                }`}
              >
                {c.nickname ?? c.name}
                <span className="num opacity-70">{formatNum(c.total)}</span>
              </Link>
            ))}
        </Card>
      )}

      {board.length === 0 ? (
        <EmptyState
          title={
            isOwnBoard
              ? "ยังไม่มีทรัพย์ในโฟกัสเจ้าของ"
              : `${viewing?.nickname ?? viewing?.name ?? "เซลส์คนนี้"} ยังไม่ได้เลือกทรัพย์ในโฟกัสเจ้าของ`
          }
          hint={
            isOwnBoard
              ? "เปิดทรัพย์ที่กำลังตามอยู่ แล้วกด “เพิ่มเข้าโฟกัสเจ้าของ” — รายชื่อจะมารวมกันที่นี่ จัดกลุ่มตามเจ้าของ"
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {board.map((owner) => (
            <OwnerGroup
              key={owner.ownerId ?? "__none__"}
              owner={owner}
              tones={tones}
              canStar={isOwnBoard}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerGroup({
  owner,
  tones,
  canStar,
}: {
  owner: FocusOwner;
  tones: Record<string, Record<string, Tone>>;
  /* The star only ever writes to YOUR board (toggleListingFocus takes the
     user from the session), so on somebody else's it would be a control that
     silently did something else. Shown read-only there instead. */
  canStar: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface-2 px-5 py-2.5">
        {owner.ownerId ? (
          <Link
            href={`/contacts/${owner.ownerId}`}
            className="text-sm font-semibold hover:underline"
          >
            {owner.ownerName || "(ไม่มีชื่อ)"}
          </Link>
        ) : (
          <span className="text-sm font-semibold text-ink-3">
            ไม่ระบุเจ้าของ
          </span>
        )}
        {owner.ownerPhone && (
          <a
            href={`tel:${owner.ownerPhone}`}
            className="num flex items-center gap-1 text-xs text-accent-text hover:underline"
          >
            <Phone size={11} />
            {owner.ownerPhone}
          </a>
        )}
        <span className="ml-auto text-[0.7rem] text-ink-3">
          {formatNum(owner.listings.length)} ทรัพย์
        </span>
      </div>

      <ul className="divide-y divide-line">
        {owner.listings.map((l) => {
          const price = l.askingPrice ?? l.rentalPrice;
          return (
            <li
              key={l.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 ${
                l.active ? "" : "bg-surface-2/50"
              }`}
            >
              {canStar ? (
                <FocusStar listingId={l.id} initial variant="icon" />
              ) : (
                <Star size={14} className="shrink-0 text-warn" fill="currentColor" />
              )}
              <Link
                href={`/listings/${l.id}`}
                className="min-w-0 flex-1 text-sm hover:underline"
              >
                <span className={l.active ? "" : "text-ink-3 line-through"}>
                  {l.listingName ?? l.legacyCode ?? "(ไม่มีชื่อ)"}
                </span>
                {l.listingName && l.legacyCode && (
                  <span className="num pl-2 text-[0.7rem] text-ink-3">
                    {l.legacyCode}
                  </span>
                )}
              </Link>
              {l.potential && (
                <Pill tone={tones.listing_potential[l.potential]}>
                  {l.potential}
                </Pill>
              )}
              <Pill tone={tones.listing_status[l.status]}>{l.status}</Pill>
              {price && (
                <span className="num shrink-0 text-xs text-ink-2">
                  {bahtShort(Number(price))}
                </span>
              )}
              {/* The reason the board is sorted the way it is — how long since
                  anyone wrote an activity on this one. */}
              <span className="shrink-0 text-[0.7rem] text-ink-3">
                {l.lastFollowedAt
                  ? daysAgoLabel(l.lastFollowedAt)
                  : "ยังไม่เคยติดตาม"}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
