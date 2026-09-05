import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getUser, getProfileName, getPrimaryBusiness } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { dashboardNav, workspaceNav } from "@/lib/nav";
import { getLocale } from "@/lib/i18n";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const [name, admin, locale, business] = await Promise.all([
    getProfileName(),
    isCurrentUserAdmin(),
    getLocale(),
    getPrimaryBusiness(),
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
      >
        {children}
      </DashboardShell>
    </LocaleProvider>
  );
}
