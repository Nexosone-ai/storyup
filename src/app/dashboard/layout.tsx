import { redirect } from "next/navigation";
import { DashboardShell, type NavItem } from "@/components/dashboard/DashboardShell";
import { getUser, getProfileName } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";

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

  const nav: NavItem[] = [
    { label: "대시보드", href: "/dashboard", icon: "home", exact: true },
    { label: "내 비즈니스", href: "/dashboard/businesses", icon: "briefcase" },
    { label: "커뮤니티", href: "/dashboard/community", icon: "chat" },
    { label: "포인트", href: "/dashboard/points", icon: "coin" },
    ...(admin
      ? [{ label: "관리자", href: "/dashboard/admin", icon: "shield" } as NavItem]
      : []),
    { label: "설정", href: "/dashboard/settings", icon: "settings" },
  ];

  return (
    <DashboardShell nav={nav} userName={name}>
      {children}
    </DashboardShell>
  );
}
