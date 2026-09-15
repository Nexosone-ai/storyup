import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const metadata = { title: "관리자" };

// 관리자 가드는 이 레이아웃에서 한 번만 — 하위 페이지는 관리자임을 전제로 데이터만 로드한다.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const admin = await isCurrentUserAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <div>
      <AdminTabs />
      {children}
    </div>
  );
}
