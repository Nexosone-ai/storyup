import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getUser, getProfileName, getBusiness } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { dashboardNav, workspaceNav } from "@/lib/nav";
import { getLocale } from "@/lib/i18n";

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

  const [name, business, admin, locale] = await Promise.all([
    getProfileName(),
    getBusiness(id),
    isCurrentUserAdmin(),
    getLocale(),
  ]);
  if (!business) notFound();

  return (
    <LocaleProvider locale={locale}>
      <DashboardShell
        nav={dashboardNav(admin, locale)}
        workspace={{ name: business.name, items: workspaceNav(id, locale) }}
        userName={name}
        locale={locale}
      >
        {children}
      </DashboardShell>
    </LocaleProvider>
  );
}
