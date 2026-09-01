import type { NavItem } from "@/components/dashboard/DashboardShell";

/** 모든 화면에서 동일하게 보이는 대시보드 메뉴. */
export function dashboardNav(admin: boolean): NavItem[] {
  return [
    { label: "대시보드", href: "/dashboard", icon: "home", exact: true },
    { label: "내 비즈니스", href: "/dashboard/businesses", icon: "briefcase" },
    { label: "커뮤니티", href: "/dashboard/community", icon: "chat" },
    {
      label: "서포터즈",
      href: "/dashboard/supporters",
      icon: "users",
      badge: "준비 중",
    },
    { label: "포인트", href: "/dashboard/points", icon: "coin" },
    ...(admin
      ? [{ label: "관리자", href: "/dashboard/admin", icon: "shield" } as NavItem]
      : []),
    { label: "설정", href: "/dashboard/settings", icon: "settings" },
  ];
}

/** 비즈니스 워크스페이스 메뉴 — STEP 순서대로 배치한다. */
export function workspaceNav(businessId: string): NavItem[] {
  const base = `/business/${businessId}`;
  return [
    { label: "개요", href: base, icon: "home", exact: true },
    { label: "브랜드 스토리", href: `${base}/brand`, icon: "sparkles", step: 1 },
    { label: "홈페이지", href: `${base}/website`, icon: "globe", step: 2 },
    { label: "블로그", href: `${base}/blog`, icon: "pen", step: 3 },
    { label: "SNS", href: `${base}/marketing`, icon: "megaphone", step: 4 },
    { label: "애널리틱스", href: `${base}/analytics`, icon: "chart" },
  ];
}
