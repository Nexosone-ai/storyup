import {
  listAgencyServicesAdmin,
  listUnassignedInquiries,
  listPendingEarnings,
  listActivePartners,
  listAllEarnings,
} from "@/lib/agency";
import { listPendingSupporters } from "@/lib/supporters";
import { AdminAgencyView } from "@/components/admin/AdminAgencyView";

export const metadata = { title: "관리자 · 대행" };

export default async function AdminAgencyPage() {
  const [
    services,
    inquiries,
    earnings,
    pendingSupporters,
    activePartners,
    earningHistory,
  ] = await Promise.all([
    listAgencyServicesAdmin(),
    listUnassignedInquiries(),
    listPendingEarnings(),
    listPendingSupporters(),
    listActivePartners(),
    listAllEarnings(),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <AdminAgencyView
        services={services}
        inquiries={inquiries}
        earnings={earnings}
        pendingSupporters={pendingSupporters.map((s) => ({
          id: s.id,
          displayName: s.display_name,
          email: s.email,
          workStatus: s.work_status,
          history: s.history,
          portfolioUrl: s.portfolio_url,
        }))}
        activePartners={activePartners}
        earningHistory={earningHistory}
      />
    </div>
  );
}
