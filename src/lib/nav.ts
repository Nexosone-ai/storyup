import type { NavItem } from "@/components/dashboard/DashboardShell";
import type { Locale } from "@/lib/i18n";

/** 모든 화면에서 동일하게 보이는 대시보드 메뉴. */
export function dashboardNav(
  admin: boolean,
  locale: Locale = "ko",
  unreadInquiries = 0,
  marketer = false,
  partner = false,
): NavItem[] {
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
      label: ko ? "문의/쿠폰관리" : "Inquiries & coupons",
      href: "/dashboard/inquiries",
      icon: "chat",
      badge: unreadInquiries > 0 ? String(unreadInquiries) : undefined,
    },
    {
      label: ko ? "서포터즈" : "Supporters",
      href: "/dashboard/supporters",
      icon: "users",
    },
    {
      label: ko ? "리워드" : "Rewards",
      href: "/dashboard/points",
      icon: "coin",
    },
    {
      label: ko ? "광고 수익" : "Ad earnings",
      href: "/dashboard/ads",
      icon: "megaphone",
      badge: ko ? "준비중" : "Soon",
    },
    {
      label: ko ? "UP 적립" : "Earn UP",
      href: "/dashboard/rewards",
      icon: "sparkles",
    },
    {
      label: ko ? "개인 도메인" : "Custom domain",
      href: "/dashboard/domain",
      icon: "globe",
    },
    {
      label: ko ? "팀 관리" : "Team",
      href: "/dashboard/team",
      icon: "users",
    },
    {
      label: ko ? "계정 공유" : "Account sharing",
      href: "/dashboard/share",
      icon: "link",
    },
    {
      label: ko ? "구독 플랜" : "Plans",
      href: "/dashboard/plans",
      icon: "tag",
    },
    ...(partner
      ? [
          {
            label: ko ? "파트너 대행" : "Partner",
            href: "/partner",
            icon: "briefcase",
          } as NavItem,
        ]
      : []),
    ...(marketer
      ? [
          {
            label: ko ? "마케터" : "Marketer",
            href: "/marketer",
            icon: "megaphone",
          } as NavItem,
        ]
      : []),
    ...(admin
      ? [
          {
            label: ko ? "관리자페이지" : "Admin",
            href: "/admin",
            icon: "shield",
          } as NavItem,
        ]
      : []),
    {
      label: ko ? "설정" : "Settings",
      href: "/dashboard/settings",
      icon: "settings",
    },
  ];
}

/** 비즈니스 워크스페이스 메뉴 — STEP 순서대로 배치한다.
 *  AI 에이전트는 대행 파트너 전용이라 파트너일 때만 노출(유저 모드엔 숨김). */
export function workspaceNav(
  businessId: string,
  locale: Locale = "ko",
  isPartner = false,
): NavItem[] {
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
      label: ko ? "랜딩페이지" : "Landing page",
      href: `${base}/website`,
      icon: "globe",
      step: 2,
    },
    { label: ko ? "블로그" : "Blog", href: `${base}/blog`, icon: "pen", step: 3 },
    { label: "SNS", href: `${base}/marketing`, icon: "megaphone", step: 4 },
    { label: ko ? "AI 영상" : "AI video", href: `${base}/video`, icon: "megaphone" },
    {
      label: ko ? "광고" : "Ads",
      href: `${base}/ads`,
      icon: "megaphone",
      badge: ko ? "준비중" : "Soon",
    },
    {
      label: ko ? "애널리틱스" : "Analytics",
      href: `${base}/analytics`,
      icon: "chart",
    },
    {
      label: ko ? "AI 전략" : "AI strategy",
      href: `${base}/strategy`,
      icon: "sparkles",
    },
    // AI 에이전트 — 대행 파트너에게만 노출.
    ...(isPartner
      ? [
          {
            label: ko ? "AI 에이전트" : "AI agent",
            href: `${base}/agent`,
            icon: "chat",
          } as NavItem,
        ]
      : []),
  ];
}
