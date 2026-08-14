import { redirect } from "next/navigation";
import { getUser, getDashboardData } from "@/lib/queries";
import { BusinessCard } from "@/components/dashboard/BusinessCard";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export const metadata = { title: "내 비즈니스" };

export default async function BusinessesPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const data = await getDashboardData(user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">내 비즈니스</h1>
        <ButtonLink href="/onboarding">
          <Icon.plus width={18} height={18} />새 비즈니스
        </ButtonLink>
      </div>

      {data.businesses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
          아직 비즈니스가 없습니다.
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
