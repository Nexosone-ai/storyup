import { listFreeReapplies } from "@/lib/freeAccess";
import { AdminFreeApprovalsView } from "@/components/admin/AdminFreeApprovalsView";

export const metadata = { title: "관리자 · 무료 재신청" };

export default async function AdminFreeApprovalsPage() {
  const rows = await listFreeReapplies();
  return (
    <div className="mx-auto max-w-3xl">
      <AdminFreeApprovalsView rows={rows} />
    </div>
  );
}
