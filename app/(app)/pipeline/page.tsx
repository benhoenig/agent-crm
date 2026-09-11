import { redirect } from "next/navigation";

// /pipeline was the kanban board's own page until 2026-08-25, when the board
// became a view of /leads. The board itself is gone (Ben, 2026-08-30) — the
// lead drawer's stage stepper moves a lead to ANY stage in one click, which
// is what the board's ◀▶ buttons were for. The route stays as a redirect so
// existing bookmarks and the LINE /plan card's links keep working.
export default function PipelineRedirect() {
  redirect("/leads");
}
