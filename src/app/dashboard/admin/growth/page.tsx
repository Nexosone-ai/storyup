import {
  getGrowthStatsAdmin,
  getGrowthSettingsAdmin,
} from "@/lib/gamification/admin";
import { getReferrerStatsAdmin } from "@/lib/admin/referrers";
import { AdminGrowthView } from "@/components/admin/AdminGrowthView";
import { AdminReferrersView } from "@/components/admin/AdminReferrersView";

export const metadata = { title: "관리자 · 성장" };

export default async function AdminGrowthPage() {
  const [stats, settings, referrers] = await Promise.all([
    getGrowthStatsAdmin(),
    getGrowthSettingsAdmin(),
    getReferrerStatsAdmin(),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <AdminGrowthView stats={stats} settings={settings} />
      <AdminReferrersView data={referrers} />
    </div>
  );
}
