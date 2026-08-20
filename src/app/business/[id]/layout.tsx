import { notFound, redirect } from "next/navigation";
import { DashboardShell, type NavItem } from "@/components/dashboard/DashboardShell";
import { getUser, getProfileName, getBusiness } from "@/lib/queries";

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

  const [name, business] = await Promise.all([
    getProfileName(),
    getBusiness(id),
  ]);
  if (!business) notFound();

  const base = `/business/${id}`;
  const nav: NavItem[] = [
    { label: "대시보드", href: "/dashboard", icon: "arrowLeft", exact: true },
    { label: "개요", href: base, icon: "home", exact: true },
    { label: "브랜드", href: `${base}/brand`, icon: "sparkles" },
    { label: "홈페이지", href: `${base}/website`, icon: "globe" },
    { label: "블로그", href: `${base}/blog`, icon: "pen" },
    { label: "마케팅", href: `${base}/marketing`, icon: "megaphone" },
    { label: "발행", href: `${base}/publishing`, icon: "external" },
    { label: "애널리틱스", href: `${base}/analytics`, icon: "chart" },
  ];

  return (
    <DashboardShell nav={nav} userName={name}>
      {children}
    </DashboardShell>
  );
}
