import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata = { title: "새 비즈니스 만들기" };

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return <OnboardingWizard />;
}
