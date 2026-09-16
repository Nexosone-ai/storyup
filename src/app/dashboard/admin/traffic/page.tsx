import { getTrafficAdmin } from "@/lib/admin/traffic";
import { AdminTrafficView } from "@/components/admin/AdminTrafficView";

export const metadata = { title: "관리자 · 트래픽" };

export default async function AdminTrafficPage() {
  const data = await getTrafficAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <AdminTrafficView data={data} />
    </div>
  );
}
