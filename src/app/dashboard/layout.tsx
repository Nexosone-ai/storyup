import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getUser, getProfileName } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { dashboardNav } from "@/lib/nav";
import { getLocale } from "@/lib/i18n";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const [name, admin, locale] = await Promise.all([
    getProfileName(),
    isCurrentUserAdmin(),
    getLocale(),
  ]);

  return (
    <LocaleProvider locale={locale}>
      <DashboardShell nav={dashboardNav(admin, locale)} userName={name} locale={locale}>
        {children}
      </DashboardShell>
    </LocaleProvider>
  );
}
