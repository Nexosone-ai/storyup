import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getUser, getProfileName, getPrimaryBusiness } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { dashboardNav, workspaceNav } from "@/lib/nav";
import { getLocale } from "@/lib/i18n";
import { getUnreadNotificationCount } from "@/lib/notifications";

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
  const [name, admin, locale, business, unreadCount] = await Promise.all([
    getProfileName(),
    isCurrentUserAdmin(),
    getLocale(),
    getPrimaryBusiness(),
    getUnreadNotificationCount(),
  ]);

  return (
    <LocaleProvider locale={locale}>
      <DashboardShell
        nav={dashboardNav(admin, locale)}
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
    </LocaleProvider>
  );
}
