import { listPartnerAssignments, listPartners } from "@/lib/partner";
import { listAllAccountShares } from "@/lib/accountShare";
import { provisioningPartnerIds } from "@/lib/partner/provisioning";
import { AdminPartnersView } from "@/components/admin/AdminPartnersView";

export const metadata = { title: "관리자 · 파트너" };

export default async function AdminPartnersPage() {
  const [assignments, accountShares, partnersRaw, provisioning] = await Promise.all([
    listPartnerAssignments(),
    listAllAccountShares(),
    listPartners(),
    provisioningPartnerIds(),
  ]);
  const partners = partnersRaw.map((p) => ({ ...p, provisioning: provisioning.has(p.userId) }));

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPartnersView
        assignments={assignments}
        accountShares={accountShares}
        partners={partners}
      />
    </div>
  );
}
