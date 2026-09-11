import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { listingOptionsForDeal } from "@/lib/repo/deals";
import { getAgentOptions } from "@/lib/repo/listings";
import { createDeal } from "../actions";
import { DealForm } from "../DealForm";

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const viewer = await getViewer();
  if (viewer.perms.deals === "none") redirect("/?tab=deals");

  const [listingOptions, agents] = await Promise.all([
    listingOptionsForDeal(viewer),
    viewer.perms.deals === "all" ? getAgentOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="บันทึกดีลใหม่"
        sub="ดีลที่ปิดแล้วเข้าสมุดรายรับ — กรอกเท่าที่มีก่อนได้"
      />
      <DealForm
        action={createDeal}
        viewer={viewer}
        listingOptions={listingOptions}
        agents={agents}
        cancelHref="/?tab=deals"
        submitLabel="บันทึกดีล"
      />
    </div>
  );
}
