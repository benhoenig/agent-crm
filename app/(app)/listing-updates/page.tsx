import Link from "next/link";
import {
  Button,
  Card,
  Dot,
  EmptyState,
  PageHeader,
  Pagination,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import {
  getListingUpdateCounts,
  LISTING_FIELD_LABEL,
  listListingUpdates,
  type ListingUpdateStatus,
} from "@/lib/repo/listing-updates";
import {
  listingUpdateRowLabel,
  LISTING_UPDATE_STATUS_TONE,
  toneFor,
} from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { param, type Search } from "@/lib/search-params";
import { cn } from "@/lib/cn";
import {
  approveListingUpdate,
  markPortalUpdated,
  rejectListingUpdate,
} from "./actions";
import { getViewer } from "@/lib/auth/session";
import { postQueueCount } from "@/lib/repo/post-queue";
import { PostQueue } from "./PostQueue";

export const dynamic = "force-dynamic";

/* รอโพสต์ is FIRST and is a different kind of tab from the four after it:
   those filter listing_updates (rows of field edits), this one lists LISTINGS
   waiting to go on the portals. Mixing two entities in one tab strip is a
   compromise, made deliberately — support asked for one page rather than two
   (Ben, 2026-09-11), and both tabs are the same person's queue for the same
   shift. It leads because it is the work; the edit tabs are the paperwork. */
const TABS: { key: string; label: string }[] = [
  { key: "to-post", label: "รอโพสต์" },
  { key: "pending", label: "รอดำเนินการ" },
  { key: "applied", label: "แก้ไขแล้ว" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "rejected", label: "ตีกลับ" },
  { key: "all", label: "ทั้งหมด" },
];

export default async function ListingUpdatesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission((p) => p.listingUpdateQueue);
  const viewer = await getViewer();
  const sp = await searchParams;

  // รอโพสต์ is the landing tab: it is the job, and the edit tabs are the
  // record of it. A support shift starts by asking what needs posting.
  const raw = param(sp, "status") || "to-post";
  const tab = TABS.some((t) => t.key === raw) ? raw : "to-post";
  const isQueue = tab === "to-post";
  const status =
    isQueue || tab === "all" ? undefined : (tab as ListingUpdateStatus);
  const page = Number(param(sp, "page")) || 1;

  // The รอโพสต์ badge is always needed (it is a tab on every view) but the
  // edit rows only when an edit tab is open — a count is one aggregate,
  // fifty joined rows are not.
  const [counts, toPostCount, updates] = await Promise.all([
    getListingUpdateCounts(),
    postQueueCount(viewer),
    isQueue ? Promise.resolve(null) : listListingUpdates({ status, page }),
  ]);
  const {
    rows,
    total,
    page: p,
    pageCount,
  } = updates ?? {
    rows: [],
    total: 0,
    page: 1,
    pageCount: 1,
  };

  const countFor = (key: string) =>
    key === "to-post"
      ? toPostCount
      : key === "all"
        ? counts.all
        : counts[key as keyof typeof counts];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="งานซัพพอร์ตประกาศ"
        sub="ทรัพย์ที่รอเอาขึ้นพอร์ทัล + ประวัติการแก้ไขรายฟิลด์และคำขอที่รอตรวจ"
      />

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={
              t.key === "to-post"
                ? "/listing-updates"
                : `/listing-updates?status=${t.key}`
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              tab === t.key
                ? "bg-accent-soft text-accent-text"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {t.label}
            <span className="num">{countFor(t.key)}</span>
          </Link>
        ))}
      </div>

      {isQueue && <PostQueue viewer={viewer} />}

      {!isQueue && (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              title={
                tab === "pending" ? "ไม่มีคำขอรอตรวจ" : "ไม่มีรายการในมุมมองนี้"
              }
              hint="ทุกการแก้ไขทรัพย์ถูกบันทึกรายฟิลด์ที่นี่โดยอัตโนมัติ"
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>เวลา</Th>
                    <Th>ทรัพย์</Th>
                    <Th>ฟิลด์</Th>
                    <Th>เดิม → ใหม่</Th>
                    <Th>โดย</Th>
                    <Th>สถานะ</Th>
                    {tab === "pending" && <Th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-surface-3"
                    >
                      <Td className="whitespace-nowrap text-ink-3">
                        {formatDateTime(u.editedAt ?? u.createdAt)}
                      </Td>
                      <Td>
                        <Link
                          href={`/listings/${u.listingId}`}
                          className="font-medium text-accent-text hover:underline"
                        >
                          {u.listingCode ?? u.listingName ?? "(ทรัพย์)"}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-2">
                        {LISTING_FIELD_LABEL[u.columnName ?? ""] ??
                          u.columnName}
                      </Td>
                      <Td className="max-w-72">
                        <div className="flex items-baseline gap-1.5 text-sm">
                          <span className="line-clamp-1 text-ink-3 line-through decoration-ink-3/50">
                            {u.oldValue || "—"}
                          </span>
                          <span className="text-ink-3">→</span>
                          <span className="line-clamp-1">
                            {u.newValue || "—"}
                          </span>
                        </div>
                      </Td>
                      <Td className="text-ink-2">
                        {u.requestedByNickname ?? u.requestedByName ?? "—"}
                      </Td>
                      <Td>
                        <Dot
                          tone={toneFor(LISTING_UPDATE_STATUS_TONE, u.status)}
                          label={listingUpdateRowLabel(u.status, u.columnName)}
                        />
                      </Td>
                      {tab === "pending" && (
                        <Td wrap>
                          <div className="flex justify-end gap-2">
                            {u.columnName === "status" ? (
                              /* portal-sync handoff: the CRM already changed —
                               "done" = every portal now matches it */
                              <form action={markPortalUpdated.bind(null, u.id)}>
                                <Button
                                  type="submit"
                                  className="px-3 py-1.5 text-xs"
                                >
                                  อัปเดตพอร์ทัลแล้ว
                                </Button>
                              </form>
                            ) : (
                              <>
                                <form
                                  action={approveListingUpdate.bind(null, u.id)}
                                >
                                  <Button
                                    type="submit"
                                    className="px-3 py-1.5 text-xs"
                                  >
                                    อนุมัติ
                                  </Button>
                                </form>
                                <form
                                  action={rejectListingUpdate.bind(null, u.id)}
                                >
                                  <Button
                                    type="submit"
                                    variant="danger"
                                    className="px-3 py-1.5 text-xs"
                                  >
                                    ตีกลับ
                                  </Button>
                                </form>
                              </>
                            )}
                          </div>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination
                page={p}
                pageCount={pageCount}
                total={total}
                hrefFor={(n) => {
                  const qs = new URLSearchParams();
                  if (tab !== "to-post") qs.set("status", tab);
                  qs.set("page", String(n));
                  return `/listing-updates?${qs.toString()}`;
                }}
              />
            </>
          )}
        </Card>
      )}

      {rows.some((r) => r.status === "pending") && (
        <p className="text-xs text-ink-3">
          การอนุมัติเป็นการรับทราบคำขอ — ผู้ตรวจแก้ข้อมูลจริงที่ฟอร์มทรัพย์
          (ระบบจะบันทึกการแก้นั้นเป็น &quot;แก้ไขแล้ว&quot; ให้เอง) · แถว
          &quot;รออัปเดตพอร์ทัล&quot; สถานะในระบบเปลี่ยนแล้ว — กด
          &quot;อัปเดตพอร์ทัลแล้ว&quot; เมื่อเอาประกาศขึ้น/ลงครบทุกพอร์ทัล
        </p>
      )}
    </div>
  );
}
