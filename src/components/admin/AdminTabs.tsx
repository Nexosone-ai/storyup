"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 관리자 페이지 탭 — 항목이 많아 한 페이지에 몰리면 보기 어려워서 영역별로 분리한다.
const TABS: { href: string; label: string }[] = [
  { href: "/dashboard/admin", label: "운영" },
  { href: "/dashboard/admin/members", label: "회원" },
  { href: "/dashboard/admin/inquiries", label: "문의고객" },
  { href: "/dashboard/admin/traffic", label: "트래픽" },
  { href: "/dashboard/admin/growth", label: "성장" },
  { href: "/dashboard/admin/products", label: "상품·주문" },
  { href: "/dashboard/admin/marketers", label: "마케터·정산" },
  { href: "/dashboard/admin/billing", label: "결제·가격" },
  { href: "/dashboard/admin/announcements", label: "공지팝업" },
  { href: "/dashboard/admin/integrity", label: "정합성" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="eyebrow mb-2">관리자</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          운영 관리
        </h1>
      </div>
      <nav className="-mx-1 mb-8 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => {
          // "운영"(루트)은 정확히 일치할 때만, 나머지는 하위 경로 포함해 활성화.
          const active =
            t.href === "/dashboard/admin"
              ? pathname === t.href
              : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface text-muted hover:border-primary/50 hover:text-primary"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
