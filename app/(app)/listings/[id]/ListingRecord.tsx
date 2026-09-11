// A listing, as it appears inside the drawer (Ben, 2026-08-29: "make the
// whole page as a drawer like Klaichan instead"). This IS the listing view —
// there is no wide detail page any more, the same way Klaichan has none.
//
// WHAT CHANGED FROM THE PAGE IT REPLACES, beyond one column instead of three:
//
//   · the price is a hero, not a row in a four-across table. It is the number
//     every conversation about a listing starts from, and it was sitting in
//     the same type size as ห้องแม่บ้าน.
//   · นอน / น้ำ / ตร.ม. are tiles. They are what you check first, and they
//     were three of fourteen facts in a grid you had to read to find them.
//   · everything else is Facts — label left, value right — because a column
//     of right-aligned values is scannable at 36rem and a four-across DL is
//     not.
//
// NOTHING WAS DROPPED. The portal editor, the edit history and the copy
// studio are all still here, because "no detail page" means this has to carry
// them.
//
// THE ORDER IS KLAICHAN'S (Ben, 2026-09-11: "use ours but with the order like
// klaichan"). Reading down: the photos, the price, the specs, the location,
// the owner and the work done on them, then the marketing, and only then the
// bookkeeping — agent, remark, edit history. The photos lead because that is
// what a listing is opened to show; everything after them answers a question
// a customer just asked, roughly in the order they ask it.
//
// It is a SERVER component and stays one: the drawer route and the full route
// both render it, and it does its own five queries either way.

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BedDouble, Ruler } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Dot,
  EmptyState,
  Facts,
  Input,
  LinkButton,
  Pill,
  Select,
  SpecTile,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { PillSelect } from "@/components/ui/PillSelect";
import { FocusStar } from "@/components/listings/FocusStar";
import { isFocused } from "@/lib/repo/focus";
import { getViewer } from "@/lib/auth/session";
import { getActivities, scopedCategories } from "@/lib/repo/activities";
import { ActivityLog } from "@/components/activity/ActivityLog";
import { mediaKind } from "@/lib/db/schema";
import { CopyStudio } from "../CopyStudio";
import { optionKeys, toneMaps } from "@/lib/repo/options";
import {
  getListing,
  getListingChannels,
  getListingMedia,
  getListingUpdates,
  getSlaRules,
  hasPendingPortalSync,
} from "@/lib/repo/listings";
import {
  listingUpdateRowLabel,
  LISTING_UPDATE_STATUS_TONE,
  MEDIA_KIND_LABEL,
  toneFor,
} from "@/lib/labels";
import {
  bkkDate,
  bkkToday,
  daysAgoLabel,
  formatBaht,
  formatDate,
  formatDateTime,
  formatNum,
} from "@/lib/format";
import { overdueBy } from "@/lib/sla";
import {
  deleteListingMedia,
  saveListingChannel,
  setListingField,
  uploadListingMedia,
} from "../actions";

function landText(rai: string | null, ngan: string | null, wa: string | null) {
  const parts = [
    rai ? `${formatNum(rai)} ไร่` : null,
    ngan ? `${formatNum(ngan)} งาน` : null,
    wa ? `${formatNum(wa)} ตร.วา` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

/** The whole drawer: what its frame shows, and what scrolls inside it.
 *  ONE function because it is ONE set of queries — a separate header loader
 *  would run getListing() a second time on every open. */
export async function loadListingDrawer(id: string): Promise<{
  title: string;
  sub: string | null;
  badges: ReactNode;
  content: ReactNode;
}> {
  const viewer = await getViewer();
  const detail = await getListing(viewer, id);
  if (!detail) notFound();

  const [
    channels,
    updates,
    media,
    slaRules,
    listingChannelNames,
    statusKeys,
    potentialKeys,
    tones,
    portalPending,
    timeline,
    activityCategories,
    focused,
  ] = await Promise.all([
    getListingChannels(id),
    getListingUpdates(id),
    getListingMedia(id),
    getSlaRules(),
    optionKeys("listing_channel"),
    // Active keys only, in the order Settings put them — the Manage pills
    // below offer these, and a retired value stays renderable because the
    // action validates against allKeys().
    optionKeys("listing_status"),
    optionKeys("listing_potential"),
    toneMaps("listing_status", "listing_potential"),
    hasPendingPortalSync(id),
    getActivities("listing", id),
    scopedCategories("listing"),
    isFocused(viewer.userId, id),
  ]);

  // Reached via /inventory: a listing outside the viewer's own scope. Everything
  // that writes is dropped below — the server actions would reject it anyway
  // (they all filter on listingScope), this just stops us offering dead buttons.
  const ro = detail.readOnly;
  const l = detail.listing;
  // Same three-way fallback as the SQL queues (today/dashboard).
  const followRef = l.lastFollowedAt ?? l.listedAt ?? bkkDate(l.createdAt);
  const over = overdueBy(
    slaRules,
    "listing_follow",
    l.potential,
    followRef,
    bkkToday()
  );

  const postText = [
    l.listingName,
    [l.propertyType, l.unitTypeName].filter(Boolean).join(" · "),
    [
      l.bed !== null ? `${l.bed} นอน` : null,
      l.bath !== null ? `${l.bath} น้ำ` : null,
      l.usableSqm ? `${formatNum(l.usableSqm)} ตร.ม.` : null,
      l.floor ? `ชั้น ${l.floor}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    detail.btsName ? `BTS ${detail.btsName}` : null,
    detail.mrtName ? `MRT ${detail.mrtName}` : null,
    l.askingPrice ? `ราคาขาย ${formatBaht(l.askingPrice)}` : null,
    l.rentalPrice ? `ค่าเช่า ${formatBaht(l.rentalPrice)}/เดือน` : null,
    l.postRemark,
  ]
    .filter(Boolean)
    .join("\n");

  const channelByName = new Map(channels.map((c) => [c.channel, c]));
  const isRent = l.listingType === "Rent";
  const perSqm =
    l.askingPrice && l.usableSqm
      ? Number(l.askingPrice) / Number(l.usableSqm)
      : null;

  // Bound here rather than inline in the JSX: a .bind() in render mints a new
  // action reference on every pass, and these cross into a client component.
  const setListingStatus = setListingField.bind(null, id, "status");
  const setListingPotential = setListingField.bind(null, id, "potential");

  const content = (
    <>
      {ro && (
        <Card className="border-info/40 bg-info/5 p-4">
          <p className="text-sm text-ink-2">
            ทรัพย์ของเซลส์คนอื่น — ดูได้อย่างเดียว แก้ไขไม่ได้
            {detail.agent?.name
              ? ` · ติดต่อ ${detail.agent.name} เพื่อร่วมปิดการขาย`
              : ""}
          </p>
        </Card>
      )}

      {/* PHOTOS FIRST, as in Klaichan (Ben, 2026-09-11). They were the
          seventh card down, which meant the one thing a sales person opens
          a listing to SHOW a customer was five scrolls past the fold. The
          order below is Klaichan's: look at it, price it, spec it, then the
          owner and the work done on them, then the marketing.

          Nothing moved out of the drawer — only up and down inside it. */}
      <Card>
        <CardHeader title="รูปภาพ / มีเดีย" />
        {media.length === 0 ? (
          <EmptyState title="ยังไม่มีรูปภาพ" hint="อัปโหลดรูปหรือวิดีโอของ Listing นี้" />
        ) : (
          // Three across, not four: the drawer is 36rem, and a four-column
          // grid here puts each thumbnail below 7rem.
          <div className="grid grid-cols-3 gap-3 px-4 pb-4">
            {media.map((m) => {
              const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(m.r2Key);
              return (
                <figure key={m.id} className="group relative">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- R2-served, session-gated route; next/image can't optimize it
                    <img
                      src={`/media/${m.r2Key}`}
                      alt={`${MEDIA_KIND_LABEL[m.kind] ?? m.kind} ${m.sortOrder + 1}`}
                      loading="lazy"
                      className="aspect-square w-full rounded-lg border border-line object-cover"
                    />
                  ) : (
                    <a
                      href={`/media/${m.r2Key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex aspect-square w-full items-center justify-center rounded-lg border border-line text-xs text-ink-3"
                    >
                      {m.r2Key.split(".").pop()?.toUpperCase()}
                    </a>
                  )}
                  <figcaption className="pt-1 text-[11px] text-ink-3">
                    {MEDIA_KIND_LABEL[m.kind] ?? m.kind}
                  </figcaption>
                  {!ro && (
                    <form
                      action={deleteListingMedia.bind(null, id, m.id)}
                      className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Button variant="secondary" className="px-2 py-0.5 text-xs">
                        ลบ
                      </Button>
                    </form>
                  )}
                </figure>
              );
            })}
          </div>
        )}
        {!ro && (
          <form
            action={uploadListingMedia.bind(null, id)}
            className="flex flex-wrap items-end gap-3 border-t border-line px-4 py-4"
          >
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              ประเภท
              <Select name="kind" defaultValue="original" required>
                {mediaKind.enumValues.map((k) => (
                  <option key={k} value={k}>
                    {MEDIA_KIND_LABEL[k] ?? k}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink-3">
              ไฟล์ (รูป / วิดีโอ / PDF, ≤ 25MB)
              <input
                type="file"
                name="file"
                required
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,application/pdf"
                className="text-sm text-ink-2 file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-ink-1"
              />
            </label>
            <Button>อัปโหลด</Button>
          </form>
        )}
      </Card>

      {/* Manage — the two labels that change most often, one tap each
          (Klaichan's สถานะ / เกรด card). Setting either used to mean opening
          the edit form, which is a route change and a full save for a
          one-word change that happens several times a call.

          A status set here carries the SAME portal obligation as one set on
          the form: setListingField runs the same audit and the same handoff,
          so taking a unit off the portals still lands in support's queue. */}
      {!ro && (
        <Card className="space-y-3 p-4">
          {/* โฟกัสเจ้าของ first: it is the one control here that says something about
              the AGENT rather than about the listing, and it is the decision
              you make while looking at the record — "this one is mine to
              chase this month". /owner-focus is where it is then worked. */}
          <FocusStar listingId={id} initial={focused} />
          <div>
            <div className="pb-1.5 text-[0.68rem] tracking-wide text-ink-3 uppercase">
              สถานะ
            </div>
            <PillSelect
              ariaLabel="สถานะทรัพย์"
              value={l.status}
              options={statusKeys.map((key) => ({
                key,
                tone: tones.listing_status[key],
              }))}
              onChange={setListingStatus}
            />
          </div>
          <div>
            <div className="pb-1.5 text-[0.68rem] tracking-wide text-ink-3 uppercase">
              เกรด
            </div>
            <PillSelect
              ariaLabel="เกรดทรัพย์"
              value={l.potential}
              options={potentialKeys.map((key) => ({
                key,
                tone: tones.listing_potential[key],
              }))}
              onChange={setListingPotential}
            />
          </div>
        </Card>
      )}

      {/* The number every conversation starts from. */}
      <Card className="bg-accent p-4 text-accent-ink">
        <div className="text-[0.68rem] tracking-wide uppercase opacity-75">
          {isRent ? "ค่าเช่า / เดือน" : "ราคาเสนอขาย"}
        </div>
        <div className="num pt-1 text-[1.8rem] leading-none font-semibold">
          {formatBaht(isRent ? l.rentalPrice : l.askingPrice)}
        </div>
        <div className="pt-1.5 text-[0.75rem] opacity-80">
          {[
            perSqm ? `${formatBaht(perSqm)}/ตร.ม.` : null,
            l.priceRemark,
            // Both prices matter on a listing carrying both; the hero shows
            // the one its type is about and this line keeps the other.
            isRent && l.askingPrice
              ? `ขาย ${formatBaht(l.askingPrice)}`
              : !isRent && l.rentalPrice
                ? `เช่า ${formatBaht(l.rentalPrice)}/เดือน`
                : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <SpecTile icon={<BedDouble size={16} />} label="นอน" value={l.bed} />
          <SpecTile icon={<Bath size={16} />} label="น้ำ" value={l.bath} />
          <SpecTile
            icon={<Ruler size={16} />}
            label="ตร.ม."
            value={l.usableSqm ? formatNum(l.usableSqm) : null}
          />
        </div>
        <Facts
          className="pt-4"
          items={[
            { label: "ประเภท", value: l.propertyType },
            { label: "แบบห้อง", value: l.unitTypeName },
            {
              label: "เลขห้อง",
              value: l.unitNo ? <span className="num">{l.unitNo}</span> : "—",
            },
            { label: "ห้องแม่บ้าน", value: l.maidRoom },
            { label: "ที่ดิน", value: landText(l.landRai, l.landNgan, l.landWa) },
            {
              label: "ชั้น / ตึก",
              value: [l.floor, l.building].filter(Boolean).join(" / ") || "—",
            },
            { label: "วิว", value: l.view },
            { label: "ทิศ", value: l.direction },
            { label: "ตำแหน่ง", value: l.position },
            { label: "สภาพห้อง", value: l.unitCondition },
            { label: "ที่จอดรถ", value: l.parking },
            {
              label: "ในโครงการ",
              value: l.inProject === null ? "—" : l.inProject ? "ใช่" : "ไม่ใช่",
            },
          ]}
        />
      </Card>

      <Card className="p-4">
        <h3 className="pb-3 text-sm font-semibold">ทำเล</h3>
        <Facts
          items={[
            {
              label: "โซน",
              value: detail.zone
                ? `${detail.zone.nameThai ?? detail.zone.nameEng} (${detail.zone.code})`
                : "—",
            },
            {
              label: "โครงการ",
              value: detail.project?.id ? (
                <Link
                  href={`/projects/${detail.project.id}`}
                  className="text-accent-text hover:underline"
                >
                  {detail.project.nameEng ?? detail.project.nameThai}
                </Link>
              ) : (
                "—"
              ),
            },
            { label: "ถนน / ซอย", value: l.streetSoi },
            { label: "เกรดทำเล", value: l.locationGrade },
            { label: "BTS", value: detail.btsName },
            { label: "MRT", value: detail.mrtName },
            { label: "ARL", value: detail.arlName },
            {
              label: "แผนที่",
              value: l.googleMapsLink ? (
                <a
                  href={l.googleMapsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-text hover:underline"
                >
                  เปิด Google Maps ↗
                </a>
              ) : (
                "—"
              ),
            },
          ]}
        />
      </Card>

      <Card className="p-4">
        <h3 className="pb-3 text-sm font-semibold">เจ้าของทรัพย์</h3>
        {!detail.ownerVisible ? (
          <p className="text-sm text-ink-3">
            ข้อมูลเจ้าของเห็นได้เฉพาะเซลส์ผู้ดูแลทรัพย์นี้
          </p>
        ) : !detail.owner ? (
          <p className="text-sm text-ink-3">
            ยังไม่มีข้อมูลเจ้าของ — เพิ่มได้ในหน้าแก้ไข
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="font-medium">{detail.owner.name ?? "—"}</div>
            {detail.owner.phone && (
              <a
                href={`tel:${detail.owner.phone}`}
                className="num block text-accent-text hover:underline"
              >
                {detail.owner.phone}
              </a>
            )}
            {detail.owner.lineId && (
              <div className="text-ink-2">LINE: {detail.owner.lineId}</div>
            )}
            <Link
              href="/contacts"
              className="block pt-1 text-xs text-ink-3 hover:text-ink"
            >
              ดูสมุดรายชื่อเจ้าของ →
            </Link>
          </div>
        )}
      </Card>

      {!ro && (
        <Card className="p-4">
          <h3 className="pb-3 text-sm font-semibold">การติดตาม</h3>
          <Facts
            items={[
              { label: "Follow ล่าสุด", value: daysAgoLabel(followRef) },
              {
                label: "สถานะ SLA",
                value:
                  over !== null && over > 0 ? (
                    <Pill tone="bad">เกิน {over} วัน</Pill>
                  ) : (
                    <Pill tone="good">ตามปกติ</Pill>
                  ),
              },
              {
                label: "คุยเจ้าของแล้ว",
                value: <span className="num">{l.ownerTalkCount} ครั้ง</span>,
              },
              { label: "วันที่โพสต์", value: formatDate(l.postedAt) },
            ]}
          />
          {/* "บันทึกว่า Follow วันนี้" used to sit here. It moved the SLA
              clock and recorded nothing, so a listing could look freshly
              followed with no trace of what was done. The log below is what
              moves it now. */}
        </Card>
      )}

      {/* NEW ON THE LISTING (Ben, 2026-08-30) — the lead had a timeline and
          this side had only a follow button, which is why owner work was
          invisible unless someone happened to plan it as a task. Above the
          edit history on purpose: this is what you DID, that is what CHANGED
          on the form. */}
      {!ro && (
        <Card>
          <CardHeader title="กิจกรรม" />
          <ActivityLog
            side="listing"
            recordId={id}
            entries={timeline}
            categories={activityCategories}
            today={bkkToday()}
            /* Owner Talk only for the agent this listing belongs to. Anyone
               else — support flagging a missing photo, a manager leaving a
               remark — composes an untagged note by default, because tagging
               would file THEIR message as the OWNER'S follow-up work. See the
               prop's own comment in ActivityLog. */
            defaultKind={l.agentId === viewer.userId ? "Owner Talk" : null}
            placeholder={
              l.agentId === viewer.userId
                ? "คุยอะไรกับเจ้าของ / ไปดูห้องเมื่อไหร่ / ตกลงราคาไว้ยังไง…"
                : "ฝากถึงผู้ดูแลทรัพย์นี้ — เช่น ข้อมูลไม่ครบ ยังโพสต์ไม่ได้…"
            }
          />
        </Card>
      )}

      {/* ── the long tail: everything that needs room ──────────────── */}

      <Card>
        <CardHeader title="ช่องทางการตลาด" />
        {/* One channel per block rather than a five-column table: the pasted
            announcement URLs are the widest thing in this record and a table
            at 36rem gives them about eighty pixels. */}
        <div className="divide-y divide-line border-t border-line">
          {listingChannelNames.map((name) => {
            const c = channelByName.get(name);
            if (ro) {
              return (
                <div
                  key={name}
                  className="flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <span className="font-medium">{name}</span>
                  {c?.boosted && <Pill tone="accent">Boost</Pill>}
                  <span className="ml-auto flex items-center gap-3 text-xs text-ink-3">
                    {c?.lastPushedAt ? formatDate(c.lastPushedAt) : "—"}
                    {c?.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-text hover:underline"
                      >
                        เปิด ↗
                      </a>
                    )}
                  </span>
                </div>
              );
            }
            return (
              <form
                key={name}
                action={saveListingChannel.bind(null, id)}
                className="space-y-2 px-4 py-2.5"
              >
                <input type="hidden" name="channel" value={name} />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{name}</span>
                  {c?.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent-text hover:underline"
                    >
                      เปิด ↗
                    </a>
                  )}
                </div>
                <Input
                  name="url"
                  defaultValue={c?.url ?? ""}
                  placeholder="URL ประกาศ"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-ink-2">
                    <input
                      type="checkbox"
                      name="boosted"
                      defaultChecked={c?.boosted ?? false}
                      className="size-3.5 accent-(--accent)"
                    />
                    Boost
                  </label>
                  <Input
                    type="date"
                    name="lastPushedAt"
                    defaultValue={c?.lastPushedAt ?? ""}
                    className="w-36"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    className="ml-auto px-3 py-1.5 text-xs"
                  >
                    บันทึก
                  </Button>
                </div>
              </form>
            );
          })}
        </div>
      </Card>

      {!ro && (
        <CopyStudio
          source={{
            legacyCode: l.legacyCode,
            listingType: l.listingType,
            potential: l.potential,
            projectEng: detail.project?.nameEng ?? null,
            projectThai: detail.project?.nameThai ?? null,
            zoneName: detail.zone?.nameThai ?? detail.zone?.nameEng ?? null,
            postRemark: l.postRemark,
            bed: l.bed,
            bath: l.bath,
            usableSqm: l.usableSqm,
            floor: l.floor,
            building: l.building,
            parking: l.parking,
            direction: l.direction,
            view: l.view,
            askingPrice: l.askingPrice,
            rentalPrice: l.rentalPrice,
            priceRemark: l.priceRemark,
          }}
        />
      )}

      <Card className="p-4">
        <h3 className="pb-3 text-sm font-semibold">ผู้ดูแล &amp; วันที่</h3>
        <Facts
          items={[
            { label: "เซลส์", value: detail.agent?.name },
            { label: "รับทรัพย์", value: formatDate(l.listedAt) },
            { label: "ปิด", value: formatDate(l.closedAt) },
            { label: "แก้ไขล่าสุด", value: formatDateTime(l.updatedAt) },
          ]}
        />
      </Card>

      {!ro && l.remarkCream && (
        <Card className="p-4">
          <h3 className="pb-2 text-sm font-semibold">Remark ภายใน</h3>
          <p className="text-sm whitespace-pre-wrap text-ink-2">
            {l.remarkCream}
          </p>
        </Card>
      )}

      {!ro && (
        <Card>
          <CardHeader title="ประวัติการแก้ไข" />
          {updates.length === 0 ? (
            <EmptyState title="ยังไม่มีการแก้ไข" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>เมื่อ</Th>
                  <Th>ฟิลด์</Th>
                  <Th>เดิม → ใหม่</Th>
                  <Th>สถานะ</Th>
                </tr>
              </thead>
              <tbody>
                {updates.map((u) => (
                  <tr key={u.id}>
                    <Td className="whitespace-nowrap text-ink-2">
                      {formatDate(u.editedAt)}
                    </Td>
                    <Td className="num text-xs">{u.columnName}</Td>
                    <Td className="max-w-40">
                      <span className="line-clamp-1 text-ink-3">
                        {u.oldValue || "—"}
                      </span>
                      <span className="line-clamp-1">{u.newValue || "—"}</span>
                    </Td>
                    <Td>
                      <Pill tone={toneFor(LISTING_UPDATE_STATUS_TONE, u.status)}>
                        {listingUpdateRowLabel(u.status, u.columnName)}
                      </Pill>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Header actions live in the drawer frame, so the copy button and the
          edit link are rendered by the route, not here — except these two,
          which belong to the record and not to the frame. */}
      <div className="flex gap-2 pb-1">
        <CopyButton text={postText} label="คัดลอกโพสต์" />
        {!ro && (
          <LinkButton variant="secondary" href={`/listings/${id}/edit`}>
            แก้ไขข้อมูลทรัพย์
          </LinkButton>
        )}
      </div>
    </>
  );

  return {
    title: l.listingName ?? l.legacyCode ?? "(ไม่มีชื่อ)",
    sub:
      [
        l.legacyCode,
        detail.zone?.nameThai ?? detail.zone?.nameEng,
        l.listingType,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    badges: (
      <>
        {l.potential && (
          <Pill tone={toneFor(tones.listing_potential, l.potential)}>
            {l.potential}
          </Pill>
        )}
        <Dot tone={toneFor(tones.listing_status, l.status)} label={l.status} />
        {portalPending && <Pill tone="warn">รอ Support อัปเดตพอร์ทัล</Pill>}
      </>
    ),
    content,
  };
}
