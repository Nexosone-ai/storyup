import {
  listAgencyServicesAdmin,
  listUnassignedInquiries,
  listPendingEarnings,
} from "@/lib/agency";
import { AdminAgencyView } from "@/components/admin/AdminAgencyView";

export const metadata = { title: "관리자 · 대행" };

export default async function AdminAgencyPage() {
  const [services, inquiries, earnings] = await Promise.all([
    listAgencyServicesAdmin(),
    listUnassignedInquiries(),
    listPendingEarnings(),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <AdminAgencyView
        services={services}
        inquiries={inquiries}
        earnings={earnings}
      />
    </div>
  );
}
