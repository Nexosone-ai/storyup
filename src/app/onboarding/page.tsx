import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getDict } from "@/lib/i18n";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata = { title: "새 비즈니스 만들기" };

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { t } = await getDict();
  return <OnboardingWizard t={t.onboarding} />;
}
