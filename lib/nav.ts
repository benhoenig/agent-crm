// App navigation — grouped like the reference design's sidebar sections.
// Icon keys resolve in components/icons.tsx. `perm` gates an item to roles
// whose matrix grants that permission (checked in Sidebar via permissionsFor);
// this is display-only — the pages themselves re-check with requirePermission.

import type { RolePermissions } from "@/lib/auth/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  perm?: keyof Pick<
    RolePermissions,
    | "settings"
    | "listingUpdateQueue"
    | "ledger"
    | "listingDirectory"
    | "leadDirectory"
    | "viewAudit"
    | "dealReview"
  >;
};
export type NavGroup = { title: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    title: "งานขาย",
    items: [
      { href: "/", label: "แดชบอร์ด", icon: "grid" },
      // แผนวันนี้ (/today) is NOT LISTED (Ben, 2026-08-28). The dashboard
      // already carries the day — PlanColumn, ติดตามวันนี้ and โพสต์เก่า all
      // mount there — so a second entry point to the same three components
      // was a choice the reader had to make for no gain.
      //
      // The route still exists and still answers; only the link is gone. It
      // keeps บันทึกกิจกรรม, which lives nowhere else.
      { href: "/plan", label: "แผนงานทั้งหมด", icon: "clipboard" },
      { href: "/listings", label: "ทรัพย์", icon: "home" },
      // No `perm`: everyone has a focus board, including the roles that hold
      // listings:"all" — the star is personal, so the page is never empty of
      // meaning for anyone. focusDirectory gates reading SOMEONE ELSE's, which
      // is a control on the page, not a reason to hide the page.
      { href: "/owner-focus", label: "โฟกัสเจ้าของ", icon: "star" },
      { href: "/leads", label: "ลูกค้า Lead", icon: "users" },
      // The two halves of the accounting job, side by side and in work order:
      // check the deal, then keep the books. บัญชี holds both; since
      // 2026-09-11 nobody else holds ตรวจดีล except ซูเปอร์แอดมิน as
      // break-glass (lib/auth/roles.ts).
      {
        href: "/deal-review",
        label: "ตรวจดีล",
        icon: "clipboard",
        perm: "dealReview",
      },
      { href: "/ledger", label: "บัญชี & P&L", icon: "wallet", perm: "ledger" },
    ],
  },
  {
    title: "คลังข้อมูล",
    items: [
      { href: "/inventory", label: "ทรัพย์ทั้งบริษัท", icon: "home", perm: "listingDirectory" },
      // The Lead twin, next to it on purpose: /ทรัพย์ and /ลูกค้า Lead are each
      // person's own book, and these two are where the company-wide read
      // lives. ผู้จัดการ and แอดมินซัพพอร์ต hold leadDirectory (roles.ts).
      { href: "/lead-directory", label: "Lead ทั้งบริษัท", icon: "users", perm: "leadDirectory" },
      { href: "/projects", label: "โครงการ", icon: "building" },
      { href: "/last-match", label: "Last Match", icon: "target" },
      { href: "/contacts", label: "ผู้ติดต่อ", icon: "contact" },
    ],
  },
  {
    title: "ทีม",
    items: [
      { href: "/team", label: "พนักงาน", icon: "team" },
      { href: "/leave", label: "วันลา", icon: "calendar" },
      { href: "/goals", label: "เป้าหมาย", icon: "flag" },
    ],
  },
  {
    title: "ระบบ",
    items: [
      {
        href: "/listing-updates",
        // Renamed from "คิวแก้ไขทรัพย์" when the รอโพสต์ queue landed on it
        // (2026-09-11): the page is no longer only about edits, and a nav
        // label that disagrees with the page title is its own small bug.
        label: "งานซัพพอร์ตประกาศ",
        icon: "clipboard",
        perm: "listingUpdateQueue",
      },
      {
        href: "/reposts",
        label: "ดันประกาศ",
        icon: "target",
        perm: "listingUpdateQueue",
      },
      {
        href: "/view-audit",
        label: "ประวัติการเข้าดู",
        icon: "clipboard",
        perm: "viewAudit",
      },
      { href: "/settings", label: "ตั้งค่า", icon: "gear", perm: "settings" },
    ],
  },
];
