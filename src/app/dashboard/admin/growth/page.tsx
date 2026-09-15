import {
  getGrowthStatsAdmin,
  getGrowthSettingsAdmin,
} from "@/lib/gamification/admin";
import { AdminGrowthView } from "@/components/admin/AdminGrowthView";

export const metadata = { title: "관리자 · 성장" };

export default async function AdminGrowthPage() {
  const [stats, settings] = await Promise.all([
    getGrowthStatsAdmin(),
    getGrowthSettingsAdmin(),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <AdminGrowthView stats={stats} settings={settings} />
    </div>
  );
}
