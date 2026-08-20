import { redirect } from "next/navigation";
import { DashboardShell, type NavItem } from "@/components/dashboard/DashboardShell";
import { getUser, getProfileName } from "@/lib/queries";

const NAV: NavItem[] = [
  { label: "대시보드", href: "/dashboard", icon: "home", exact: true },
  { label: "내 비즈니스", href: "/dashboard/businesses", icon: "briefcase" },
  { label: "커뮤니티", href: "/dashboard/community", icon: "chat" },
  { label: "설정", href: "/dashboard/settings", icon: "settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const name = await getProfileName();

  return (
    <DashboardShell nav={NAV} userName={name}>
      {children}
    </DashboardShell>
  );
}
