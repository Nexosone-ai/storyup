import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getUser, getProfileName } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { dashboardNav } from "@/lib/nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const [name, admin] = await Promise.all([
    getProfileName(),
    isCurrentUserAdmin(),
  ]);

  return (
    <DashboardShell nav={dashboardNav(admin)} userName={name}>
      {children}
    </DashboardShell>
  );
}
