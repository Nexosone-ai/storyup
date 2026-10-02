import { getPointsLedgerAdmin } from "@/lib/admin/points";
import { AdminPointsView } from "@/components/admin/AdminPointsView";

export const metadata = { title: "관리자 · 포인트" };

export default async function AdminPointsPage() {
  const ledger = await getPointsLedgerAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <AdminPointsView ledger={ledger} />
    </div>
  );
}
