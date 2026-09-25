import { getLatestIntegrityReport } from "@/lib/admin/integrity";
import { AdminIntegrityView } from "@/components/admin/AdminIntegrityView";

export const metadata = { title: "관리자 · 데이터 정합성" };

export default async function AdminIntegrityPage() {
  const latest = await getLatestIntegrityReport();
  return (
    <div className="mx-auto max-w-2xl">
      <AdminIntegrityView latest={latest} />
    </div>
  );
}
