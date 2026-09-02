import type { NavItem } from "@/components/dashboard/DashboardShell";
import type { Locale } from "@/lib/i18n";

/** 모든 화면에서 동일하게 보이는 대시보드 메뉴. */
export function dashboardNav(admin: boolean, locale: Locale = "ko"): NavItem[] {
  const ko = locale === "ko";
  return [
    {
      label: ko ? "대시보드" : "Dashboard",
      href: "/dashboard",
      icon: "home",
      exact: true,
    },
    {
      label: ko ? "내 비즈니스" : "My businesses",
      href: "/dashboard/businesses",
      icon: "briefcase",
    },
    {
      label: ko ? "서포터즈" : "Supporters",
      href: "/dashboard/supporters",
      icon: "users",
      badge: ko ? "준비 중" : "Soon",
    },
    {
      label: ko ? "포인트" : "Points",
      href: "/dashboard/points",
      icon: "coin",
    },
    ...(admin
      ? [
          {
            label: ko ? "관리자" : "Admin",
            href: "/dashboard/admin",
            icon: "shield",
          } as NavItem,
        ]
      : []),
    {
      label: ko ? "설정" : "Settings",
      href: "/dashboard/settings",
      icon: "settings",
    },
    {
      label: ko ? "메인 페이지" : "Main site",
      href: "/",
      icon: "globe",
      exact: true,
    },
  ];
}

/** 비즈니스 워크스페이스 메뉴 — STEP 순서대로 배치한다. */
export function workspaceNav(businessId: string, locale: Locale = "ko"): NavItem[] {
  const ko = locale === "ko";
  const base = `/business/${businessId}`;
  return [
    { label: ko ? "개요" : "Overview", href: base, icon: "home", exact: true },
    {
      label: ko ? "브랜드 스토리" : "Brand story",
      href: `${base}/brand`,
      icon: "sparkles",
      step: 1,
    },
    {
      label: ko ? "홈페이지" : "Website",
      href: `${base}/website`,
      icon: "globe",
      step: 2,
    },
    { label: ko ? "블로그" : "Blog", href: `${base}/blog`, icon: "pen", step: 3 },
    { label: "SNS", href: `${base}/marketing`, icon: "megaphone", step: 4 },
    {
      label: ko ? "애널리틱스" : "Analytics",
      href: `${base}/analytics`,
      icon: "chart",
    },
  ];
}
