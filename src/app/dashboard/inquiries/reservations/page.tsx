import { getLocale } from "@/lib/i18n";
import { getUserReservations } from "@/lib/events";
import { DashboardReservationsView } from "@/components/dashboard/DashboardReservationsView";

export const metadata = { title: "예약 관리" };

export default async function DashboardReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const [{ post }, reservations, locale] = await Promise.all([
    searchParams,
    getUserReservations(),
    getLocale(),
  ]);

  return (
    <DashboardReservationsView
      reservations={reservations}
      focusPostId={post ?? null}
      lang={locale === "ko" ? "ko" : "en"}
    />
  );
}
