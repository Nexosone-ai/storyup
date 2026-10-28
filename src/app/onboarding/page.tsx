import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getDict } from "@/lib/i18n";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { getIndustryStartDefaults } from "@/lib/industries";
import {
  BUSINESS_CATEGORIES,
  INDUSTRY_IDS,
  type BusinessCategory,
  type IndustryId,
} from "@/types/domain";

export const metadata = {
  title: "새 비즈니스 만들기",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { t } = await getDict();

  // '이 업종으로 시작하기'에서 넘어온 업종 → 기존 category/industry 기본값으로만 사용.
  // (자동 생성·과금 없음. 사용자가 온보딩에서 바꿀 수 있음.)
  const { industry: slug } = await searchParams;
  let initialCategory: BusinessCategory | undefined;
  let initialIndustry: IndustryId | undefined;
  if (slug) {
    const defaults = await getIndustryStartDefaults(slug);
    if (defaults) {
      if (
        defaults.category &&
        (BUSINESS_CATEGORIES as readonly string[]).includes(defaults.category)
      )
        initialCategory = defaults.category as BusinessCategory;
      if (
        defaults.industry &&
        (INDUSTRY_IDS as readonly string[]).includes(defaults.industry)
      )
        initialIndustry = defaults.industry as IndustryId;
    }
  }

  return (
    <OnboardingWizard
      t={t.onboarding}
      initialCategory={initialCategory}
      initialIndustry={initialIndustry}
    />
  );
}
