import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { getDeal, listingOptionsForDeal } from "@/lib/repo/deals";
import { getAgentOptions } from "@/lib/repo/listings";
import { updateDeal } from "../../actions";
import { DealForm } from "../../DealForm";

export const dynamic = "force-dynamic";

export default async function EditDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  const [detail, listingOptions, agents] = await Promise.all([
    getDeal(viewer, id),
    listingOptionsForDeal(viewer),
    viewer.perms.deals === "all" ? getAgentOptions() : Promise.resolve([]),
  ]);
  if (!detail) notFound();
  // A reviewed deal is locked — the action refuses too; this is just the door.
  if (detail.deal.reviewedAt) redirect(`/deals/${id}`);

  const title =
    detail.listing?.listingName ??
    detail.listing?.legacyCode ??
    detail.deal.legacyCode ??
    "ดีล";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={`แก้ไขดีล: ${title}`}
        sub="ข้อมูลผู้ซื้อ/ผู้ขายทางกฎหมายแก้ไขได้เฉพาะแอดมิน"
      />
      <DealForm
        action={updateDeal.bind(null, id)}
        viewer={viewer}
        listingOptions={listingOptions}
        agents={agents}
        defaults={detail.deal}
        cancelHref={`/deals/${id}`}
        submitLabel="บันทึกการแก้ไข"
      />
    </div>
  );
}
