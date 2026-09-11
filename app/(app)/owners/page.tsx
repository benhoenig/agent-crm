import { redirect } from "next/navigation";

// /owners became /contacts on 2026-08-25 when the owners table merged into
// contacts — sellers, buyers and co-agents are one person book. Kept so old
// links and bookmarks still land somewhere.
export default function OwnersRedirect() {
  redirect("/contacts");
}
