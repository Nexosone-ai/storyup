import { getProfileName } from "@/lib/queries";
import { AdminView } from "@/components/admin/AdminView";

// 관리자 가드는 layout.tsx에서 처리한다. 여기선 운영(포인트 지급·플랜 관리)만.
export default async function AdminPage() {
  await getProfileName(); // ensures profile exists
  return <AdminView />;
}
