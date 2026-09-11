// The full page. Reached by refresh, a pasted link, or the AI tray from a
// cold load — a client-side click on + เพิ่มทรัพย์ is intercepted into a
// modal instead (app/(app)/@modal/(.)listings/new). Both render <NewListing>.

import { LinkButton, PageHeader } from "@/components/ui";
import { param, type Search } from "@/lib/search-params";
import {
  NEW_LISTING_SUB,
  NEW_LISTING_TITLE,
  NewListing,
} from "./NewListing";

export const dynamic = "force-dynamic";

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const draftId = Number(param(sp, "draft")) || null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title={NEW_LISTING_TITLE} sub={NEW_LISTING_SUB} />
      <NewListing
        draftId={draftId}
        cancel={
          <LinkButton variant="ghost" href="/listings">
            ยกเลิก
          </LinkButton>
        }
      />
    </div>
  );
}
