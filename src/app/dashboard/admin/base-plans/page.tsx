import { getBasePlanCatalog } from "@/lib/b2b2c/basePlans";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { AdminBasePlansView } from "@/components/admin/AdminBasePlansView";

export const metadata = { title: "본사 기본상품" };

// 관리자 레이아웃이 admin 가드. 여기선 데이터만 로드.
export default async function AdminBasePlansPage() {
  const catalog = await getBasePlanCatalog();
  return (
    <AdminBasePlansView
      enabled={B2B2C_ENABLED}
      plans={[catalog.basic, catalog.pro]}
    />
  );
}
