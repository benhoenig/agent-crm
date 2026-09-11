"use client";

/* ทีมของฉัน — a manager picks which sales agents report to them.

   WHY THIS EXISTS SEPARATELY FROM THE HR EDIT PAGE (Ben, 2026-08-29). Setting
   สังกัดผู้จัดการ used to live only on /team/[id]/edit, behind `teamManage`,
   which is admin — so the reporting line was HR's job and a manager could not
   build their own team. But handing managers `teamManage` would hand them ID
   card numbers, addresses, emergency contacts and agreement files, none of
   which claiming a report requires.

   CLAIM, NOT ASSIGN. Every write puts the CALLER's id on the row (the server
   action takes it from the session, never from the request), so a manager can
   add someone to their own team and remove someone from it, and there is no
   shape of the call that files somebody under a third person. Admin keeps the
   full dropdown for the cases that genuinely need moving somebody sideways.

   AN AGENT ON ANOTHER MANAGER'S TEAM IS SHOWN AS SUCH, with the name, rather
   than hidden or disabled. Hiding them would make the roster look short and
   leave "why isn't Ploy here" unanswerable; disabling them would make moving
   an agent an admin ticket. Naming the current manager makes the click a
   decision instead of a surprise. */

import { useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { claimSalesMember } from "@/app/(app)/team/actions";

export interface RosterRow {
  id: string;
  name: string;
  nickname: string | null;
  image: string | null;
  managerId: string | null;
  managerName: string | null;
}

export function MyTeamPanel({
  roster,
  viewerId,
  viewerName,
}: {
  roster: RosterRow[];
  viewerId: string;
  viewerName: string;
}) {
  const mine = roster.filter((r) => r.managerId === viewerId).length;

  return (
    <Card>
      <CardHeader
        title="ทีมของฉัน"
        action={
          <span className="num text-xs text-ink-3">
            {mine}/{roster.length} คน
          </span>
        }
      />
      <p className="px-5 pb-3 text-[0.72rem] text-ink-3">
        ติ๊กเลือกเซลส์ที่อยู่ใต้สังกัดคุณ — คุณจะเป็นผู้ตั้งเป้ารายได้และ KPI ให้คนที่เลือก
      </p>
      <ul className="space-y-1 px-5 pb-5">
        {roster.map((r) => (
          <RosterItem
            key={r.id}
            row={r}
            viewerId={viewerId}
            viewerName={viewerName}
          />
        ))}
      </ul>
    </Card>
  );
}

function RosterItem({
  row,
  viewerId,
  viewerName,
}: {
  row: RosterRow;
  viewerId: string;
  viewerName: string;
}) {
  const [pending, start] = useTransition();
  const isMine = row.managerId === viewerId;
  const elsewhere = row.managerId !== null && !isMine;

  return (
    <li className={`flex items-center gap-2.5 ${pending ? "opacity-50" : ""}`}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={isMine}
          disabled={pending}
          onChange={(e) => {
            const next = e.currentTarget.checked;
            start(async () => {
              await claimSalesMember(row.id, next);
            });
          }}
          className="size-3.5 shrink-0 accent-[var(--accent)]"
        />
        <Avatar
          image={row.image}
          name={row.nickname ?? row.name}
          size="size-7 text-[0.68rem]"
        />
        <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
      </label>
      {pending ? (
        <LoaderCircle size={13} className="shrink-0 animate-spin text-ink-3" />
      ) : isMine ? (
        <span className="shrink-0 text-[0.7rem] text-accent-text">
          {viewerName}
        </span>
      ) : elsewhere ? (
        <span className="shrink-0 text-[0.7rem] text-ink-3">
          อยู่ทีม {row.managerName}
        </span>
      ) : (
        <span className="shrink-0 text-[0.7rem] text-ink-3">ยังไม่มีสังกัด</span>
      )}
    </li>
  );
}
