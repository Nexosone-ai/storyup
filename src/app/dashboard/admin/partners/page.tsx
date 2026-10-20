import { createAdminClient } from "@/lib/supabase/server";
import { listPartnerAssignments } from "@/lib/partner";
import { listAllAccountShares } from "@/lib/accountShare";
import {
  AdminPartnersView,
  type CreditPriceRow,
} from "@/components/admin/AdminPartnersView";

export const metadata = { title: "관리자 · 파트너" };

export default async function AdminPartnersPage() {
  const admin = createAdminClient();
  const [assignments, pricesRes, accountShares] = await Promise.all([
    listPartnerAssignments(),
    admin
      .from("partner_credit_prices")
      .select("action, label, credits, active")
      .order("credits", { ascending: false }),
    listAllAccountShares(),
  ]);
  const prices = (pricesRes.data ?? []) as CreditPriceRow[];

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPartnersView
        assignments={assignments}
        prices={prices}
        accountShares={accountShares}
      />
    </div>
  );
}
