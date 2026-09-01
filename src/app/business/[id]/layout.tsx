import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getUser, getProfileName, getBusiness } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { dashboardNav, workspaceNav } from "@/lib/nav";

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

  const [name, business, admin] = await Promise.all([
    getProfileName(),
    getBusiness(id),
    isCurrentUserAdmin(),
  ]);
  if (!business) notFound();

  return (
    <DashboardShell
      nav={dashboardNav(admin)}
      workspace={{ name: business.name, items: workspaceNav(id) }}
      userName={name}
    >
      {children}
    </DashboardShell>
  );
}
