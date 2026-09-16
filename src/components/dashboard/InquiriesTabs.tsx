"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import { useLocale } from "@/components/i18n/LocaleProvider";

/** 문의/쿠폰관리 탭 네비게이션 (문의 · 쿠폰). */
export function InquiriesTabs() {
  const ko = useLocale() === "ko";
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard/inquiries", label: ko ? "문의" : "Inquiries", exact: true },
    {
      href: "/dashboard/inquiries/coupons",
      label: ko ? "쿠폰" : "Coupons",
      exact: false,
    },
  ];

  return (
    <div className="inline-flex gap-1 rounded-xl border border-border bg-surface p-1">
      {tabs.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
