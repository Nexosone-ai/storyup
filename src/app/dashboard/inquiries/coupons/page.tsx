import { getLocale } from "@/lib/i18n";
import { getUserCouponClaims } from "@/lib/events";
import { DashboardCouponsView } from "@/components/dashboard/DashboardCouponsView";

export const metadata = { title: "쿠폰 관리" };

export default async function DashboardCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const [{ post }, claims, locale] = await Promise.all([
    searchParams,
    getUserCouponClaims(),
    getLocale(),
  ]);

  return (
    <DashboardCouponsView
      claims={claims}
      focusPostId={post ?? null}
      lang={locale === "ko" ? "ko" : "en"}
    />
  );
}
