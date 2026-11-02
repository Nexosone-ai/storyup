import { notFound } from "next/navigation";
import Link from "next/link";
import { getBusiness } from "@/lib/queries";
import { getDict } from "@/lib/i18n";
import { BusinessSettingsForm } from "@/components/business/BusinessSettingsForm";

export const metadata = { title: "세부설정" };

export default async function BusinessSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();
  const { t, locale } = await getDict();
  const ko = locale === "ko";

  const links = [
    {
      href: `/business/${id}/website`,
      label: ko ? "랜딩페이지 · 디자인 · 광고(AdSense)" : "Landing page · design · ads",
    },
    {
      href: "/dashboard/domain",
      label: ko ? "개인 도메인 연결" : "Custom domain",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="eyebrow mb-2">{ko ? "비즈니스" : "Business"}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "세부설정" : "Settings"}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "이 비즈니스의 이름과 업종을 관리해요."
            : "Manage this business's name and category."}
        </p>
      </div>

      <BusinessSettingsForm
        businessId={id}
        name={business.name}
        category={business.category}
        categoryLabels={t.onboarding.categoryLabels}
      />

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">
          {ko ? "관련 설정" : "Related settings"}
        </h2>
        <ul className="mt-3 space-y-1.5">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm hover:border-primary"
              >
                <span className="truncate">{l.label}</span>
                <span aria-hidden className="shrink-0 text-muted">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
