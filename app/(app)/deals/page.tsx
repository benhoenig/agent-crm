import { redirect } from "next/navigation";

// The deal list became the ดีลปิด tab of the dashboard on 2026-08-25.
// /deals/[id] and /deals/new are unchanged; only the LIST moved, and this
// route stays so existing links and bookmarks land on the tab.
export default function DealsRedirect() {
  redirect("/?tab=deals");
}
