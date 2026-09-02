import { redirect } from "next/navigation";
import { getUser, getProfileName, getDashboardData } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { BusinessCard } from "@/components/dashboard/BusinessCard";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export const metadata = { title: "대시보드" };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const ko = (await getLocale()) === "ko";
  const [name, data] = await Promise.all([
    getProfileName(),
    getDashboardData(user.id),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{greeting()}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {ko ? `${name}님, 반가워요` : `Welcome back, ${name}`}
          </h1>
          <p className="mt-1.5 text-muted">
            {ko
              ? "오늘도 당신의 이야기를 키워볼까요?"
              : "Ready to grow your story today?"}
          </p>
        </div>
        <ButtonLink href="/onboarding">
          <Icon.plus className="size-[18px]" />
          {ko ? "새 비즈니스 만들기" : "Create new business"}
        </ButtonLink>
      </div>

      <SummaryCards totals={data.totals} />

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          {ko ? "내 비즈니스" : "My businesses"}
        </h2>
        {data.businesses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
            <div className="mx-auto mb-5 grid size-12 place-items-center rounded-xl bg-primary-soft text-primary">
              <Icon.sparkles />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">
              {ko ? "아직 만든 비즈니스가 없어요" : "No businesses yet"}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
              {ko
                ? "사업 이야기를 들려주면 AI가 브랜드와 홈페이지, 블로그를 만들어드립니다. 5분이면 충분해요."
                : "Tell us your story and AI builds your brand, website, and blog. It only takes 5 minutes."}
            </p>
            <div className="mt-7">
              <ButtonLink href="/onboarding">
                <Icon.plus className="size-[18px]" />
                {ko ? "첫 비즈니스 만들기" : "Create your first business"}
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {data.businesses.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
