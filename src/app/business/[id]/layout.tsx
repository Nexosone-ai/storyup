import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import {
  getUser,
  getProfileName,
  getBusiness,
  getUnreadInquiryCount,
} from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { dashboardNav, workspaceNav } from "@/lib/nav";
import { getLocale } from "@/lib/i18n";
import { getUnreadNotificationCount } from "@/lib/notifications";

// robots.txt 차단만으로는 링크된 URL이 색인될 수 있어 meta로도 명시한다.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/login");

  const [name, business, admin, locale, unreadCount, unreadInquiries] =
    await Promise.all([
      getProfileName(),
      getBusiness(id),
      isCurrentUserAdmin(),
      getLocale(),
      getUnreadNotificationCount(),
      getUnreadInquiryCount(),
    ]);
  if (!business) notFound();

  return (
    <LocaleProvider locale={locale}>
      <DashboardShell
        nav={dashboardNav(admin, locale, unreadInquiries)}
        workspace={{
          name: business.name,
          items: workspaceNav(id, locale),
        }}
        userName={name}
        locale={locale}
        unreadCount={unreadCount}
      >
        {children}
      </DashboardShell>
    </LocaleProvider>
  );
}
