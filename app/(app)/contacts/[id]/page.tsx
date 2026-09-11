import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  DL,
  Dot,
  EmptyState,
  LinkButton,
  Pill,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { toneMaps } from "@/lib/repo/options";
import { headers } from "next/headers";
import {
  getContact,
  getContactLeads,
  getContactListings,
} from "@/lib/repo/contacts";
import { getLiveOwnerLink } from "@/lib/repo/shares";
import { CopyButton } from "@/components/CopyButton";
import { createOwnerLink, revokeOwnerLink } from "../actions";
import { MergeContact } from "@/components/contacts/MergeContact";
import {
  toneFor,
  PIPELINE_STAGE_TONE,
} from "@/lib/labels";
import { formatBaht, formatDateTime, formatNum } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  const contact = await getContact(viewer, id);
  if (!contact) notFound();

  const [liveLink, hdrs] = await Promise.all([
    getLiveOwnerLink(id),
    headers(),
  ]);
  const origin = `https://${hdrs.get("host") ?? "localhost"}`;
  const [ownerListings, contactLeads, tones] = await Promise.all([
    getContactListings(viewer, id),
    getContactLeads(viewer, id),
    toneMaps("listing_status", "listing_potential"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{contact.name ?? "(ไม่มีชื่อ)"}</h1>
          <p className="pt-0.5 text-sm text-ink-3">
            แก้ไขล่าสุด {formatDateTime(contact.updatedAt)}
          </p>
        </div>
        <LinkButton variant="secondary" href={`/contacts/${id}/edit`}>
          แก้ไข
        </LinkButton>
      </div>

      <Card>
        <CardHeader title="ข้อมูลติดต่อ" />
        <div className="px-5 pb-5">
          <DL
            cols={3}
            items={[
              { label: "ชื่อ", value: contact.name },
              {
                label: "เบอร์โทร",
                value: contact.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="num text-accent-text hover:underline"
                  >
                    {contact.phone}
                  </a>
                ) : (
                  "—"
                ),
              },
              { label: "LINE ID", value: contact.lineId },
              { label: "อีเมล", value: contact.email },
              { label: "เพศ", value: contact.gender },
              { label: "สัญชาติ", value: contact.nationality },
            ]}
          />
          {contact.remark && (
            <div className="pt-4">
              <div className="text-xs text-ink-3">หมายเหตุ</div>
              <p className="pt-0.5 text-sm whitespace-pre-wrap text-ink-2">
                {contact.remark}
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="ทรัพย์ที่เป็นเจ้าของ" />
        {ownerListings.length === 0 ? (
          <EmptyState
            title="ยังไม่มีทรัพย์ที่รายนี้เป็นเจ้าของ"
            hint="ทรัพย์จะผูกกับรายชื่อนี้เมื่อเบอร์โทรตรงกัน"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ทรัพย์</Th>
                <Th>สถานะ</Th>
                <Th>เกรด</Th>
                <Th className="text-right">ราคา</Th>
              </tr>
            </thead>
            <tbody>
              {ownerListings.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-surface-3">
                  <Td>
                    <Link href={`/listings/${l.id}`} className="block">
                      <div className="font-medium">
                        {l.listingName ?? l.legacyCode ?? "(ไม่มีชื่อ)"}
                      </div>
                      {l.legacyCode && (
                        <div className="num pt-0.5 text-xs text-ink-3">
                          {l.legacyCode}
                        </div>
                      )}
                    </Link>
                  </Td>
                  <Td>
                    <Dot tone={toneFor(tones.listing_status, l.status)} label={l.status} />
                  </Td>
                  <Td>
                    {l.potential ? (
                      <Pill tone={toneFor(tones.listing_potential, l.potential)}>
                        {l.potential}
                      </Pill>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="num text-right">
                    {formatBaht(l.askingPrice ?? l.rentalPrice)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ── the other half of the merge: this person as a BUYER. Before the
             tables merged, a buyer lived in `contacts` and an owner in
             `owners`, so no page could ever show both sides of one human. ── */}
      {contactLeads.length > 0 && (
        <Card>
          <CardHeader title="Lead ในฐานะผู้ซื้อ" />
          <Table>
            <thead>
              <tr>
                <Th>ความสนใจ</Th>
                <Th>Stage</Th>
                <Th>เกรด</Th>
                <Th className="text-right">งบ</Th>
              </tr>
            </thead>
            <tbody>
              {contactLeads.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-surface-3">
                  <Td>
                    <Link href={`/leads/${l.id}`} className="block">
                      <div className="font-medium">
                        {l.initialInterest ?? l.legacyCode ?? "(ไม่ระบุ)"}
                      </div>
                    </Link>
                  </Td>
                  <Td>
                    <Pill tone={toneFor(PIPELINE_STAGE_TONE, l.pipelineStage)}>
                      {l.pipelineStage}
                    </Pill>
                  </Td>
                  <Td>{l.potential ?? "—"}</Td>
                  <Td className="num text-right">
                    {l.budgetMillion ? `${formatNum(l.budgetMillion)} ลบ.` : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ── owner report link — the seller's progress page ─────────── */}
      <Card>
        <CardHeader
          title="รายงานสำหรับเจ้าของ"
          action={
            <span className="text-xs text-ink-3">
              ลิงก์ไม่ต้องล็อกอิน — เจ้าของเห็นสถานะการตลาดของทรัพย์ตัวเองสดๆ
            </span>
          }
        />
        <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
          {liveLink ? (
            <>
              <Pill tone="good">เปิดอยู่</Pill>
              <span className="text-xs text-ink-3">
                สร้าง {formatDateTime(liveLink.createdAt)} · เปิดดู{" "}
                <span className="num">{liveLink.viewCount}</span> ครั้ง
              </span>
              <span className="ml-auto flex items-center gap-2">
                <CopyButton
                  text={`${origin}/owner-report/${liveLink.token}`}
                  label="คัดลอกลิงก์"
                />
                <form action={createOwnerLink.bind(null, id)}>
                  <Button type="submit" variant="ghost" className="text-xs">
                    ออกลิงก์ใหม่
                  </Button>
                </form>
                <form action={revokeOwnerLink.bind(null, id)}>
                  <Button type="submit" variant="ghost" className="text-xs text-ink-3">
                    ปิดลิงก์
                  </Button>
                </form>
              </span>
            </>
          ) : (
            <>
              <span className="text-sm text-ink-2">ยังไม่มีลิงก์รายงานสำหรับเจ้าของรายนี้</span>
              <form action={createOwnerLink.bind(null, id)} className="ml-auto">
                <Button type="submit" variant="secondary">
                  สร้างลิงก์รายงาน
                </Button>
              </form>
            </>
          )}
        </div>
      </Card>

      {/* Whole-book roles only, matching mergeContacts' own refusal. A scoped
          agent sees a fraction of the contacts book, so "these two are the
          same person" is a call they cannot make safely — and the card would
          only offer them the half they can see. Last on the page because it
          is repair work, not part of reading a contact. */}
      {viewer.perms.ownerContacts === "all" && (
        <MergeContact
          winnerId={id}
          winnerName={contact.name ?? "(ไม่มีชื่อ)"}
          winner={{
            name: contact.name,
            phone: contact.phone,
            lineId: contact.lineId,
            email: contact.email,
          }}
        />
      )}
    </div>
  );
}
