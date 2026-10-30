import {
  listAllInvoices,
  listSettlements,
  getB2b2cStats,
} from "@/lib/b2b2c/admin";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { AdminPartnerSalesView } from "@/components/admin/AdminPartnerSalesView";

export const metadata = { title: "파트너 판매 · 정산" };

// 관리자 레이아웃이 admin 가드. 여기선 데이터만 로드.
export default async function AdminPartnerSalesPage() {
  const [invoices, settlements, stats] = await Promise.all([
    listAllInvoices(),
    listSettlements(),
    getB2b2cStats(),
  ]);
  return (
    <AdminPartnerSalesView
      enabled={B2B2C_ENABLED}
      invoices={invoices}
      settlements={settlements}
      stats={stats}
    />
  );
}
