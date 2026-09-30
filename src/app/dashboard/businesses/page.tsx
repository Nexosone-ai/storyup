import { redirect } from "next/navigation";
import { getUser, getDashboardData } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { BusinessCard } from "@/components/dashboard/BusinessCard";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export const metadata = { title: "내 비즈니스" };

export default async function BusinessesPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const ko = (await getLocale()) === "ko";
  const data = await getDashboardData(user.id);

  // 플랜별 사업장 개수 제한 — 한도 도달 시 추가 버튼 대신 업그레이드 안내.
  const plan = getPlanById(await getPlanId(user.id));
  const atLimit =
    plan.maxBusinesses !== null && data.businesses.length >= plan.maxBusinesses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "내 비즈니스" : "My businesses"}
        </h1>
        {atLimit ? (
          <ButtonLink href="/dashboard/plans" variant="outline">
            {ko ? "플랜 업그레이드" : "Upgrade plan"}
          </ButtonLink>
        ) : (
          <ButtonLink href="/onboarding">
            <Icon.plus width={18} height={18} />
            {ko ? "새 비즈니스" : "New business"}
          </ButtonLink>
        )}
      </div>

      {atLimit && (
        <p className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
          {ko
            ? `현재 ${plan.name.ko} 플랜은 사업장 ${plan.maxBusinesses}개까지 관리할 수 있어요. 더 추가하려면 플랜을 업그레이드해주세요.`
            : `Your ${plan.name.en} plan manages up to ${plan.maxBusinesses} business${plan.maxBusinesses === 1 ? "" : "es"}. Upgrade to add more.`}
        </p>
      )}

      {data.businesses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
          {ko ? "아직 비즈니스가 없습니다." : "No businesses yet."}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.businesses.map((b) => (
            <BusinessCard key={b.id} business={b} />
          ))}
        </div>
      )}
    </div>
  );
}
