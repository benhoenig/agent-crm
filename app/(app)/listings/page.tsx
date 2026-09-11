import { ListingsIndex } from "./ListingsIndex";
import type { Search } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return <ListingsIndex sp={await searchParams} />;
}
