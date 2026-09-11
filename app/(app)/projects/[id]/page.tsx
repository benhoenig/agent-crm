import { notFound } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  DL,
  EmptyState,
  Field,
  LinkButton,
  Pill,
  Select,
  Textarea,
} from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { optionKeys } from "@/lib/repo/options";
import {
  canEditProject,
  getPersonas,
  getProject,
  getProjectMedia,
} from "@/lib/repo/projects";
import { ProjectCover, ProjectGallery } from "@/components/projects/ProjectGallery";
import { trackView, viewersOf } from "@/lib/repo/views";
import { formatDateTime, formatNum } from "@/lib/format";
import { addPersona, deletePersona } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Reads stay open to everyone — a survey is only worth keeping if the agent
  // standing in front of that building can read it, and 1,626 listings point
  // at one of these. What changed (Ben, 2026-09-11) is that reading is now
  // RECORDED rather than restricted.
  const viewer = await getViewer();

  const detail = await getProject(id);
  if (!detail) notFound();

  /* Logged here, after the record is known to exist, so a mistyped URL is not
     a "view". Runs in after() → waitUntil, so the reader waits on nothing.

     THIS ONLY COUNTS REAL OPENS BECAUSE OF TWO THINGS THAT ARE EASY TO BREAK.
     Next prefetches <Link>s on hover and in the viewport; for a DYNAMIC route
     it fetches only down to the nearest loading.js boundary, so this component
     does not run. Both conditions hold today — `force-dynamic` above and
     ./loading.tsx beside this file — and both must keep holding. Delete that
     loading.tsx, or set prefetch={true} on a link to a project, and this table
     fills with views nobody made, which is worse than no log at all: it would
     accuse people. (Prefetch is production-only, so dev will not show it.) */
  trackView(viewer, "project", id);
  const [personas, trustTriggers, photos, readers] = await Promise.all([
    getPersonas(id),
    optionKeys("trust_trigger"),
    getProjectMedia(id),
    // Only fetched for the people allowed to read it — an empty array
    // otherwise, so the card below simply does not render. Gating the QUERY
    // and not just the markup keeps the answer off the wire entirely.
    viewer.perms.viewAudit
      ? viewersOf("project", id)
      : Promise.resolve([]),
  ]);

  const p = detail.project;
  const zoneName = detail.zone
    ? `${detail.zone.nameThai ?? detail.zone.nameEng} (${detail.zone.code})`
    : null;
  const canEdit = canEditProject(viewer, p.createdBy);
  const name = p.nameEng ?? p.nameThai ?? "(ไม่มีชื่อ)";
  const sub =
    [p.nameEng ? p.nameThai : null, zoneName, p.propertyType]
      .filter(Boolean)
      .join(" · ") || null;

  /* สิ่งอำนวยความสะดวก arrives as one free-text cell from the sheet —
     "สระว่ายน้ำ, ฟิตเนส, สวนลอยฟ้า". In a three-column DL that wrapped into an
     unreadable ribbon; as chips it reads the way a property page lists
     facilities. Split only when the text actually looks like a list: a single
     sentence stays a sentence rather than becoming one enormous chip. */
  const facilities = (p.commonFacilities ?? "")
    .split(/[,·\n•]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const facilityChips = facilities.length > 1 ? facilities : [];

  // Long marketing texts render as paragraphs, not DL facts.
  const marketing = [
    { label: "คีย์เวิร์ด", value: p.keywords },
    { label: "กลุ่มลูกค้าเป้าหมาย", value: p.targetCustomers },
    { label: "คอนเซปต์", value: p.concept },
    { label: "ข้อดี", value: p.pros },
    { label: "ข้อเสีย", value: p.cons },
  ].filter((s) => s.value);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* THE BUILDING FIRST. This page used to open with an h1 and then seven
          identically-weighted grey cards, so everything looked equally
          important and nothing was findable — Ben's "อ่านง่ายขึ้นเหมือนดูทรัพย์
          ใน website". The cover, the headline facts and the จุดเด่น now carry
          the top; the survey's full field list is still below, unchanged. */}
      <ProjectCover photo={photos[0] ?? null} name={name} sub={sub} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* Repeated under the photo only when there is no photo to carry it
              — otherwise the cover already shows the name. */}
          {photos.length === 0 && (
            <>
              <h1 className="text-xl font-bold">{name}</h1>
              <p className="pt-1 text-sm text-ink-3">{sub ?? "—"}</p>
            </>
          )}
          {photos.length > 0 && p.developer && (
            <p className="text-sm text-ink-3">โดย {p.developer}</p>
          )}
        </div>
        {/* The edit button is hidden for anyone who is not the surveyor, and
            the action refuses them too — this only stops us offering a door
            that opens onto a redirect. */}
        {canEdit ? (
          <LinkButton variant="secondary" href={`/projects/${id}/edit`}>
            แก้ไข
          </LinkButton>
        ) : (
          <span className="text-xs text-ink-3">
            สำรวจโดย {detail.surveyorName ?? "ไม่ระบุ"} — แก้ไขได้เฉพาะผู้สำรวจ
          </span>
        )}
      </div>

      {/* The five facts you check before reading anything else. */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "ประเภท", value: p.propertyType },
            { label: "ปีที่สร้างเสร็จ", value: p.yearBuilt },
            { label: "จำนวนยูนิต", value: p.units },
            { label: "ค่าส่วนกลาง", value: p.commonFee },
            { label: "ราคาเฉลี่ย / ตร.ม.", value: p.avgPricePerSqm },
          ].map((f) => (
            <div key={f.label}>
              <div className="text-xs text-ink-3">{f.label}</div>
              <div className="pt-0.5 text-sm font-semibold">
                {f.value ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* จุดเด่น and สิ่งอำนวยความสะดวก used to be two cells in the ไลฟ์สไตล์
          grid below, where a paragraph of facilities wrapped into an
          unreadable ribbon a third of a column wide. They are the two fields
          a person actually reads, so they get the room.

          BOTH CARDS RENDER EVEN WHEN EMPTY, and that is on purpose: this app
          treats an unfilled field as information (see Facts in components/ui —
          "on a CRM built out of a spreadsheet, 'nobody has ever filled this
          in' is itself worth seeing"). Hiding them would make a half-done
          survey look finished, which is the opposite of useful to the next
          agent standing outside that building. */}
      <Card>
        <CardHeader title="จุดเด่นโครงการ" />
        {p.highlights ? (
          <p className="px-5 pb-5 text-sm leading-relaxed whitespace-pre-wrap">
            {p.highlights}
          </p>
        ) : (
          <p className="px-5 pb-5 text-sm text-ink-3">
            ยังไม่ได้บันทึกจุดเด่น
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="สิ่งอำนวยความสะดวกส่วนกลาง" />
        {facilityChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-5 pb-5">
            {facilityChips.map((f) => (
              <Pill key={f} tone="muted">
                {f}
              </Pill>
            ))}
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm whitespace-pre-wrap text-ink-3">
            {p.commonFacilities ?? "ยังไม่ได้บันทึกสิ่งอำนวยความสะดวก"}
          </p>
        )}
      </Card>

      <ProjectGallery projectId={id} photos={photos} canEdit={canEdit} />

      <Card>
        <CardHeader title="ภาพรวม" />
        <div className="px-5 pb-5">
          <DL
            cols={3}
            items={[
              { label: "ประเภทโครงการ", value: p.propertyType },
              {
                label: "โซน",
                value:
                  zoneName ??
                  (p.zoneRaw ? (
                    <span className="text-ink-3">{p.zoneRaw} (ข้อความจากชีต ยังไม่จับคู่โซน)</span>
                  ) : (
                    "—"
                  )),
              },
              { label: "ผู้พัฒนา", value: p.developer },
              { label: "ปีที่สร้างเสร็จ", value: p.yearBuilt ? <span className="num">{p.yearBuilt}</span> : "—" },
              { label: "จำนวนตึก", value: p.buildings },
              { label: "จำนวนชั้น", value: p.floors },
              { label: "จำนวนยูนิต", value: p.units },
              { label: "ยูนิตต่อชั้น", value: p.unitsPerFloor },
              { label: "เซกเมนต์", value: p.segment },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="ค่าส่วนกลาง & ที่จอด" />
        <div className="px-5 pb-5">
          <DL
            cols={3}
            items={[
              { label: "ค่าส่วนกลาง", value: p.commonFee },
              { label: "เงื่อนไขการชำระ", value: p.commonFeeTerms },
              { label: "% การเก็บค่าส่วนกลาง", value: p.commonFeeCollectionPct },
              { label: "นิติบุคคล", value: p.juristicPerson },
              { label: "อัตราส่วนที่จอดรถ", value: p.parkingRatio },
              { label: "ซื้อที่จอดเพิ่มได้หรือไม่", value: p.extraParkingPurchasable },
              { label: "ค่าที่จอดเพิ่ม", value: p.extraParkingFee },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="ราคา & ผลตอบแทน" />
        <div className="px-5 pb-5">
          <DL
            cols={3}
            items={[
              { label: "ราคาเฉลี่ย / ตร.ม.", value: p.avgPricePerSqm },
              { label: "Rental Yield", value: p.rentalYield },
              { label: "โครงการเทียบเคียง", value: p.comparables },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="สเปคยูนิต" />
        <div className="px-5 pb-5">
          <DL
            cols={3}
            items={[
              { label: "แบบยูนิต", value: p.unitTypes },
              { label: "ความสูงฝ้าเพดาน", value: p.ceilingHeight },
              { label: "วิวที่ดีที่สุด", value: p.bestView },
              { label: "ทิศที่ดีที่สุด", value: p.bestDirection },
              { label: "ตำแหน่งที่ดีที่สุด", value: p.bestPosition },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="ไลฟ์สไตล์ & บริบท" />
        <div className="px-5 pb-5">
          <DL
            cols={3}
            items={[
              { label: "สัดส่วนสัญชาติผู้อยู่อาศัย", value: p.nationalityMix },
              { label: "เลี้ยงสัตว์", value: p.petsAllowed },
              { label: "สูบบุหรี่", value: p.smokingAllowed },
              { label: "ร้านค้าในโครงการ", value: p.shops },
              { label: "สถานีรถไฟฟ้าใกล้สุด", value: p.nearestStationInfo },
              { label: "รถ Shuttle", value: p.shuttleInfo },
              // จุดเด่น and สิ่งอำนวยความสะดวก moved to their own cards above —
              // both are prose and neither survives a third of a grid column.
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="การขาย & การตลาด" />
        {marketing.length === 0 ? (
          <EmptyState
            title="ยังไม่มีข้อมูลการขาย"
            hint="คีย์เวิร์ด กลุ่มลูกค้า คอนเซปต์ ข้อดี/ข้อเสีย — เพิ่มได้ในหน้าแก้ไข"
          />
        ) : (
          <div className="space-y-4 px-5 pb-5">
            {marketing.map((s) => (
              <div key={s.label}>
                <div className="text-xs text-ink-3">{s.label}</div>
                <p className="pt-0.5 text-sm whitespace-pre-wrap">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 2026 quake-assessment initiative — keep this section visible even when empty */}
      <Card>
        <CardHeader title="การประเมินหลังแผ่นดินไหว" />
        <div className="px-5 pb-5">
          <DL
            cols={3}
            items={[
              { label: "ประวัติการซ่อมแซม", value: p.quakeRepairHistory },
              { label: "ใบรับรองความปลอดภัยโครงสร้าง", value: p.quakeSafetyCert },
              { label: "ประกันภัยแผ่นดินไหว", value: p.quakeInsurance },
              { label: "รอยร้าวภายนอกอาคาร", value: p.quakeExteriorCracks },
              { label: "สภาพรอยต่ออาคาร", value: p.quakeJointsCondition },
              { label: "สภาพภายในอาคาร", value: p.quakeInteriorCondition },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Persona ผู้ซื้อ" />
        {personas.length === 0 ? (
          <EmptyState
            title="ยังไม่มี Persona"
            hint="ความรู้เรื่องผู้ซื้อของโครงการนี้ — ใครซื้อ ทำไมซื้อ เชื่อเพราะอะไร ทั้งทีมเห็นร่วมกัน"
          />
        ) : (
          <ul className="divide-y divide-line px-5">
            {personas.map((persona) => (
              <li key={persona.id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm whitespace-pre-wrap">{persona.persona}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1.5">
                    {persona.trustTrigger && (
                      <Pill tone="muted">{persona.trustTrigger}</Pill>
                    )}
                    <span className="text-xs text-ink-3">
                      {persona.salesName ?? "ไม่ระบุผู้บันทึก"}
                    </span>
                  </div>
                </div>
                <form action={deletePersona.bind(null, id, persona.id)}>
                  <Button type="submit" variant="ghost" className="px-2 py-1 text-xs">
                    ลบ
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form
          action={addPersona.bind(null, id)}
          className="space-y-3 border-t border-line px-5 py-4"
        >
          <Field label="เพิ่ม Persona ผู้ซื้อ">
            <Textarea
              name="persona"
              rows={3}
              required
              placeholder="ใครซื้อโครงการนี้ ทำไมถึงซื้อ…"
            />
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Trust Trigger" className="w-full max-w-xs">
              <Select name="trustTrigger" defaultValue="">
                <option value="">— ไม่ระบุ —</option>
                {trustTriggers.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">
              เพิ่ม Persona
            </Button>
          </div>
        </form>
      </Card>

      {/* ใครเปิดดูบ้าง — the per-record half of the access log. Managers and
          ซูเปอร์แอดมิน only (viewAudit): it says where colleagues spend their
          attention, which is not something to leave lying on a shared page.

          NOT SHOWN AS AN EMPTY CARD when nobody has opened it yet — an audit
          panel reading "0 people" on every survey would train the eye to skip
          it, and this is a thing that should be noticed when it has content. */}
      {viewer.perms.viewAudit && readers.length > 0 && (
        <Card>
          <CardHeader
            title="ใครเปิดดูโครงการนี้"
            action={
              <span className="text-xs text-ink-3">
                นับตั้งแต่เริ่มเก็บบันทึก · เก็บไว้ 90 วัน
              </span>
            }
          />
          <ul className="divide-y divide-line px-5">
            {readers.map((r) => (
              <li
                key={r.userId}
                className="flex items-center justify-between gap-4 py-2.5 text-sm"
              >
                <span className="font-medium">{r.userName ?? "—"}</span>
                <span className="flex items-center gap-3 text-xs text-ink-3">
                  <span className="num">{formatNum(r.opens)} ครั้ง</span>
                  <span className="num">{formatDateTime(r.lastAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
