// HARD LOADS ONLY, now. A click on แก้ไขข้อมูลทรัพย์ from inside the drawer is
// intercepted into app/(app)/@modal/(.)listings/[id]/edit, which opens the
// form over the drawer. This is what a refresh, a pasted link or a new tab
// gets: the same form, as the full page it has always been.

import { LinkButton, PageHeader } from "@/components/ui";
import { EDIT_LISTING_SUB, loadListingEditor } from "./EditListing";

export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { title, form } = await loadListingEditor(
    id,
    <LinkButton variant="ghost" href={`/listings/${id}`}>
      ยกเลิก
    </LinkButton>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title={title} sub={EDIT_LISTING_SUB} />
      {form}
    </div>
  );
}
