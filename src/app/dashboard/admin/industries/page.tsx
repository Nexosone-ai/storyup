import { listAllIndustries } from "@/lib/industries";
import { BUSINESS_CATEGORIES, INDUSTRY_IDS } from "@/types/domain";
import { AdminIndustriesView } from "@/components/admin/AdminIndustriesView";

export const metadata = { title: "업종 관리" };

// 관리자 가드는 /dashboard/admin/layout.tsx에서 수행(여기서는 관리자 가정) + 액션에서 재검증.
export default async function AdminIndustriesPage() {
  const industries = await listAllIndustries();
  return (
    <div className="mx-auto max-w-3xl">
      <AdminIndustriesView
        industries={industries}
        categories={[...BUSINESS_CATEGORIES]}
        industryIds={[...INDUSTRY_IDS]}
      />
    </div>
  );
}
