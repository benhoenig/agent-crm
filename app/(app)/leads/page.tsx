import { LeadsIndex } from "./LeadsIndex";
import type { Search } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return <LeadsIndex sp={await searchParams} />;
}
