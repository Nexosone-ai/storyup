import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import {
  getUser,
  getProfileName,
  getPrimaryBusiness,
  getUnreadInquiryCount,
  needsOnboarding,
} from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { isCurrentUserMarketer } from "@/lib/marketers";
import { dashboardNav, workspaceNav } from "@/lib/nav";
import { getLocale } from "@/lib/i18n";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { getActiveAnnouncement } from "@/lib/admin/announcements";
import { AnnouncementPopup } from "@/components/announcements/AnnouncementPopup";
import { WelcomeGuide } from "@/components/onboarding/WelcomeGuide";
import { InstallPromptPopup } from "@/components/pwa/InstallPromptPopup";

// robots.txt 차단만으로는 링크된 URL이 색인될 수 있어 meta로도 명시한다.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const [
    name,
    admin,
    marketer,
    locale,
    business,
    unreadCount,
    unreadInquiries,
    announcement,
    showWelcome,
  ] = await Promise.all([
    getProfileName(),
    isCurrentUserAdmin(),
    isCurrentUserMarketer(),
    getLocale(),
    getPrimaryBusiness(),
    getUnreadNotificationCount(),
    getUnreadInquiryCount(),
    getActiveAnnouncement(),
    needsOnboarding(),
  ]);

  return (
    <LocaleProvider locale={locale}>
      <DashboardShell
        nav={dashboardNav(admin, locale, unreadInquiries, marketer)}
        workspace={
          business
            ? { name: business.name, items: workspaceNav(business.id, locale) }
            : undefined
        }
        userName={name}
        locale={locale}
        unreadCount={unreadCount}
      >
        {children}
      </DashboardShell>
      {/* 팝업 우선순위: 첫 진입 환영 가이드 > 공지 > 앱 설치 유도 (한 번에 하나만) */}
      {showWelcome ? (
        <WelcomeGuide />
      ) : announcement ? (
        <AnnouncementPopup announcement={announcement} />
      ) : (
        <InstallPromptPopup />
      )}
    </LocaleProvider>
  );
}
