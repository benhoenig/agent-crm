// A lead, as it appears inside the drawer (Ben, 2026-08-29: "make the whole
// page as a drawer like Klaichan instead"). This IS the lead view — there is
// no wide detail page any more, the same way Klaichan has none.
//
// The twin of app/(app)/listings/[id]/ListingRecord.tsx; see that file for
// why the loader returns the frame's pieces and the body together rather
// than exporting two functions that would each query the record.
//
// The three-column grid is gone with the page. Everything is one column, in
// Klaichan's order: who they are and what they want, the stage they are at,
// what they told you, the money, what was sent, the log of work done, and
// Complain last because it is the rare one.

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  Dot,
  EmptyState,
  Facts,
  Field,
  Input,
  LinkButton,
  Pill,
  Select,
  Textarea,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { optionKeys, toneMaps } from "@/lib/repo/options";
import { headers } from "next/headers";
import { getLead, shareableListings } from "@/lib/repo/leads";
import { getActivities, scopedCategories } from "@/lib/repo/activities";
import { ActivityLog } from "@/components/activity/ActivityLog";
import { PillSelect } from "@/components/ui/PillSelect";
import { listSharesForLead } from "@/lib/repo/shares";
import { CopyButton } from "@/components/CopyButton";
import { ShareListingPicker } from "@/components/leads/ShareListingPicker";
import { getSlaRules } from "@/lib/repo/listings";
import { PIPELINE_STAGES, PIPELINE_STAGE_TONE, toneFor } from "@/lib/labels";
import {
  bkkDate,
  bkkToday,
  daysAgoLabel,
  formatDate,
  formatDateTime,
  formatNum,
} from "@/lib/format";
import { overdueBy } from "@/lib/sla";
import {
  createShare,
  revokeShare,
  saveClosing,
  saveComplain,
  setLeadField,
  setLeadStage,
} from "../actions";

export const dynamic = "force-dynamic";

/** The whole drawer: what its frame shows, and what scrolls inside it. */
export async function loadLeadDrawer(id: string): Promise<{
  title: string;
  sub: ReactNode;
  badges: ReactNode;
  content: ReactNode;
}> {
  const viewer = await getViewer();
  const detail = await getLead(viewer, id);
  if (!detail) notFound();

  const [
    timeline,
    slaRules,
    actionCategories,
    caseStatuses,
    leadStatuses,
    complainSeverities,
    complainStatuses,
    potentialKeys,
    tones,
  ] = await Promise.all([
    getActivities("lead", id),
    getSlaRules(),
    scopedCategories("lead"),
    optionKeys("case_status"),
    optionKeys("lead_status"),
    optionKeys("complain_severity"),
    optionKeys("complain_status"),
    // Active keys, in Settings' order — the Manage pills offer these; a
    // retired value stays settable because setLeadField checks allKeys().
    optionKeys("lead_potential"),
    toneMaps(
      "lead_potential",
      "lead_status",
      "case_status",
      "complain_severity",
      "complain_status"
    ),
  ]);
  const [shareRows, shareOptions, hdrs] = await Promise.all([
    listSharesForLead(id),
    /* The picker's FIRST PAGE, not its contents. It searches the whole book
       from the client (ShareListingPicker -> lookupShareableListings), so this
       only has to be enough to open on — where the old checkbox list had to
       be, and at 100 rows could not be, every listing you might send. */
    shareableListings(viewer),
    headers(),
  ]);
  const origin = `https://${hdrs.get("host") ?? "localhost"}`;

  const l = detail.lead;
  const c = detail.contact;
  const lastDate = l.lastFollowedAt ?? bkkDate(l.createdAt);
  const over = overdueBy(slaRules, "lead_follow", l.potential, lastDate, bkkToday());

  const contents = [
    { label: "Background", value: l.background },
    { label: "Requirement", value: l.requirement },
    { label: "Pain Point", value: l.painPoint },
    { label: "Progress", value: l.progress },
    { label: "Activity Comment", value: l.activityComment },
  ].filter((s): s is { label: string; value: string } => s.value !== null);

  // Bound outside the JSX — see the note in the listings twin.
  const setLeadStatus = setLeadField.bind(null, id, "leadStatus");
  const setLeadPotential = setLeadField.bind(null, id, "potential");

  const content = (
    <>
      {/* KLAICHAN'S ORDER (Ben, 2026-09-11: "use ours but with the order
          like klaichan"). Who they are and what they want comes first —
          that is what you need in hand when they pick up — then the stage
          you are moving them through, then what they told you, the money,
          what you sent them, and the log of work done.

          The stage stepper used to lead. It is the thing you touch LAST in
          a call, not the thing you read first. */}

      <Card>
        <CardHeader title="ข้อมูล Lead" />
        <div className="px-5 pb-5">
          <Facts
            items={[
              { label: "Lead Type", value: l.leadType },
              { label: "แหล่งที่มา", value: l.source },
              { label: "ติดต่อผ่าน", value: l.contactBy },
              {
                label: "งบประมาณ",
                value: l.budgetMillion ? (
                  <span className="num">
                    {formatNum(l.budgetMillion)} ลบ.
                  </span>
                ) : (
                  "—"
                ),
              },
              { label: "Timeline", value: l.timeline },
              {
                label: "รับเข้าเมื่อ",
                value: formatDateTime(l.submittedAt ?? l.createdAt),
              },
              { label: "ผู้ดูแล", value: detail.assignedName },
              { label: "สร้างโดย", value: detail.createdByName },
              {
                label: "ทรัพย์ที่สนใจ",
                value: detail.listing?.id ? (
                  <Link
                    href={`/listings/${detail.listing.id}`}
                    className="text-accent-text hover:underline"
                  >
                    {detail.listing.listingName ??
                      detail.listing.legacyCode ??
                      "(ไม่มีชื่อ)"}
                  </Link>
                ) : (
                  (l.initialInterest ?? "—")
                ),
              },
            ]}
          />
        </div>
      </Card>

      {/* stage stepper — every stage is one click; "Win" is just a stage */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pipeline Stage</h2>
          <span className="text-xs text-ink-3">
            Follow ล่าสุด: {daysAgoLabel(lastDate)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-3">
          {PIPELINE_STAGES.map((stage, i) => (
            <Fragment key={stage}>
              {i > 0 && <span className="text-xs text-ink-3">→</span>}
              {stage === l.pipelineStage ? (
                <span className="inline-flex items-center rounded-ctl bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-glow">
                  {stage}
                </span>
              ) : (
                <form action={setLeadStage.bind(null, id, stage)}>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                  >
                    {stage}
                  </Button>
                </form>
              )}
            </Fragment>
          ))}
        </div>

        {/* สถานะ and เกรด joined the stage stepper here (Ben, 2026-09-11) so
            this is Klaichan's one Manage card rather than one control in the
            drawer and two behind the edit form. All three are the same kind
            of act — relabelling where this lead stands — and they belong in
            one place.

            Only the STAGE stamps lastFollowedAt. See setLeadField. */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-4">
          <div>
            <div className="pb-1.5 text-[0.68rem] tracking-wide text-ink-3 uppercase">
              สถานะ
            </div>
            <PillSelect
              ariaLabel="สถานะ Lead"
              value={l.leadStatus}
              options={leadStatuses.map((key) => ({
                key,
                tone: tones.lead_status[key],
              }))}
              onChange={setLeadStatus}
            />
          </div>
          <div>
            <div className="pb-1.5 text-[0.68rem] tracking-wide text-ink-3 uppercase">
              เกรด
            </div>
            <PillSelect
              ariaLabel="เกรด Lead"
              value={l.potential}
              options={potentialKeys.map((key) => ({
                key,
                tone: tones.lead_potential[key],
              }))}
              onChange={setLeadPotential}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="เนื้อหา" />
        {contents.length === 0 ? (
          <EmptyState
            title="ยังไม่มีบันทึกเนื้อหา"
            hint="Background / Requirement / Pain Point เพิ่มได้จากหน้าแก้ไข"
          />
        ) : (
          <div className="space-y-4 px-5 pb-5">
            {contents.map((s) => (
              <div key={s.label}>
                <div className="text-xs text-ink-3">{s.label}</div>
                <p className="pt-0.5 text-sm whitespace-pre-wrap text-ink-2">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="ปิดเคส"
          action={
            l.caseStatus ? (
              <Pill tone={toneFor(tones.case_status, l.caseStatus)}>
                {l.caseStatus}
              </Pill>
            ) : undefined
          }
        />
        <form
          action={saveClosing.bind(null, id)}
          className="space-y-3 px-5 pb-5"
        >
          <Field label="ค่าคอมมิชชั่น (฿)">
            <Input
              name="commission"
              defaultValue={l.commission ?? ""}
              className="num"
            />
          </Field>
          <Field label="สินเชื่อธนาคาร">
            <Input name="bankLoan" defaultValue={l.bankLoan ?? ""} />
          </Field>
          <Field label="ยูนิตที่ปิด">
            <Input name="closingUnit" defaultValue={l.closingUnit ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="วันที่ปิด">
              <Input
                type="date"
                name="closingDate"
                defaultValue={l.closingDate ?? ""}
              />
            </Field>
            <Field label="วันที่โอน">
              <Input
                type="date"
                name="transferDate"
                defaultValue={l.transferDate ?? ""}
              />
            </Field>
          </div>
          <Field label="หมายเหตุการปิด">
            <Textarea
              name="closingRemark"
              rows={3}
              defaultValue={l.closingRemark ?? ""}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Case Status">
              <Select name="caseStatus" defaultValue={l.caseStatus ?? ""}>
                <option value="">— เลือก —</option>
                {caseStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Lead Status">
              <Select name="leadStatus" defaultValue={l.leadStatus}>
                {leadStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="secondary" className="w-full">
            บันทึกปิดเคส
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="ส่งทรัพย์ให้ลูกค้า"
          action={
            <span className="text-xs text-ink-3">
              ลิงก์ไม่ต้องล็อกอิน — ลูกค้าตอบ สนใจ/ยังไม่ใช่ กลับมาเอง
            </span>
          }
        />
        <div className="space-y-4 px-5 pb-5">
          {shareRows.map((s) => (
            <div key={s.id} className="rounded-ctl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {s.revokedAt ? (
                  <Pill tone="muted">ปิดแล้ว</Pill>
                ) : (
                  <Pill tone="good">เปิดอยู่</Pill>
                )}
                <span className="text-xs text-ink-3">
                  สร้าง {formatDate(s.createdAt)}
                  {s.createdByName ? ` · ${s.createdByName}` : ""} · เปิดดู{" "}
                  <span className="num">{s.viewCount}</span> ครั้ง
                  {s.lastViewedAt ? ` · ล่าสุด ${formatDate(s.lastViewedAt)}` : ""}
                </span>
                {!s.revokedAt ? (
                  <span className="ml-auto flex items-center gap-2">
                    <CopyButton text={`${origin}/share/${s.token}`} label="คัดลอกลิงก์" />
                    <form action={revokeShare.bind(null, id, s.id)}>
                      <Button type="submit" variant="ghost" className="text-xs text-ink-3">
                        ปิดลิงก์
                      </Button>
                    </form>
                  </span>
                ) : null}
              </div>
              <ul className="space-y-1 pt-2">
                {s.listings.map((sl) => (
                  <li key={sl.listingId} className="flex flex-wrap items-center gap-2 text-sm">
                    <Link href={`/listings/${sl.listingId}`} className="text-accent-text hover:underline">
                      {sl.listingName ?? sl.legacyCode ?? "ทรัพย์"}
                    </Link>
                    {sl.feedback === "interested" ? (
                      <Pill tone="good">สนใจ</Pill>
                    ) : sl.feedback === "rejected" ? (
                      <Pill tone="bad">ยังไม่ใช่</Pill>
                    ) : (
                      <Pill tone="muted">ยังไม่ตอบ</Pill>
                    )}
                    {sl.feedbackReasons?.length ? (
                      <span className="text-xs text-ink-3">{sl.feedbackReasons.join(", ")}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <form action={createShare.bind(null, id)} className="space-y-2">
            <p className="text-xs font-semibold text-ink-2">
              เลือกทรัพย์ที่จะส่ง แล้วสร้างลิงก์ใหม่
            </p>
            <ShareListingPicker initial={shareOptions} />
            <div className="flex justify-end">
              <Button type="submit" variant="secondary">
                สร้างลิงก์ส่งลูกค้า
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <Card>
        <CardHeader title="กิจกรรม" />
        {/* The composer + history that replaced the "Follow วันนี้" button
            (Ben, 2026-08-30). Only buyer-side kinds are offered here; owner
            work belongs on the listing. */}
        <ActivityLog
          side="lead"
          recordId={id}
          entries={timeline}
          categories={actionCategories}
          today={bkkToday()}
          /* Follow only for the agent this lead is assigned to — the listing
             side carries the full reasoning. */
          defaultKind={l.assignedTo === viewer.userId ? "Follow" : null}
          placeholder={
            l.assignedTo === viewer.userId
              ? "คุยอะไรกับลูกค้า / นัดเมื่อไหร่ / ติดขัดตรงไหน…"
              : "ฝากถึงเซลส์ที่ดูแลลูกค้ารายนี้…"
          }
        />
      </Card>

      <Card>
        <CardHeader
          title="Complain"
          action={
            l.complainSeverity || l.complainStatus ? (
              <span className="flex gap-1.5">
                {l.complainSeverity && (
                  <Pill
                    tone={toneFor(
                      tones.complain_severity,
                      l.complainSeverity
                    )}
                  >
                    {l.complainSeverity}
                  </Pill>
                )}
                {l.complainStatus && (
                  <Pill
                    tone={toneFor(tones.complain_status, l.complainStatus)}
                  >
                    {l.complainStatus}
                  </Pill>
                )}
              </span>
            ) : undefined
          }
        />
        <form
          action={saveComplain.bind(null, id)}
          className="space-y-3 px-5 pb-5"
        >
          <Field label="รายละเอียด Complain">
            <Textarea
              name="complain"
              rows={3}
              defaultValue={l.complain ?? ""}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ความรุนแรง">
              <Select
                name="severity"
                defaultValue={l.complainSeverity ?? ""}
              >
                <option value="">— เลือก —</option>
                {complainSeverities.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="สถานะ">
              <Select name="status" defaultValue={l.complainStatus ?? ""}>
                <option value="">— เลือก —</option>
                {complainStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="secondary" className="w-full">
            บันทึก Complain
          </Button>
        </form>
      </Card>

      {/* The two header buttons of the page this replaces. In a drawer the
          frame's right edge is for closing, so the actions live with the
          record. */}
      {/* "Follow วันนี้" used to live here. It stamped the SLA clock and wrote
          no activity at all, so a lead could go from overdue to current with
          nothing on the record saying what was done. Writing in the log above
          is what moves the clock now. */}
      <div className="flex gap-2 pb-1">
        <LinkButton variant="secondary" href={`/leads/${id}/edit`}>
          แก้ไขข้อมูล Lead
        </LinkButton>
      </div>
    </>
  );

  return {
    title: c?.name ?? "(ไม่มีชื่อ)",
    sub: (
      <>
        {c?.phone ? (
          <a href={`tel:${c.phone}`} className="num text-accent-text hover:underline">
            {c.phone}
          </a>
        ) : (
          "—"
        )}
        {c?.lineId && <> · LINE: {c.lineId}</>}
        {c?.email && <> · {c.email}</>}
      </>
    ),
    badges: (
      <>
        {l.potential && (
          <Pill tone={toneFor(tones.lead_potential, l.potential)}>
            {l.potential}
          </Pill>
        )}
        <Dot tone={toneFor(tones.lead_status, l.leadStatus)} label={l.leadStatus} />
        <Pill tone={toneFor(PIPELINE_STAGE_TONE, l.pipelineStage)}>
          {l.pipelineStage}
        </Pill>
        {over !== null && over > 0 && <Pill tone="bad">เกิน {over} วัน</Pill>}
      </>
    ),
    content,
  };
}
