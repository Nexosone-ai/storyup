import { notFound } from "next/navigation";
import { getUser } from "@/lib/queries";
import { isCurrentUserPartner, listPartnerClients } from "@/lib/partner";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { basePriceForPlan } from "@/lib/b2b2c/products";
import { getMyStorefront } from "@/lib/b2b2c/storefront";
import { listMyProducts } from "@/lib/b2b2c/products";
import { listMyOffers } from "@/lib/b2b2c/offers";
import { listMyInvoices } from "@/lib/b2b2c/invoices";
import { createAdminClient } from "@/lib/supabase/server";
import { PartnerSalesView } from "@/components/partner/PartnerSalesView";

export const metadata = {
  title: "상품 · 판매",
  robots: { index: false, follow: false },
};

export default async function PartnerSalesPage() {
  if (!B2B2C_ENABLED) notFound();
  const user = await getUser();
  if (!user || !(await isCurrentUserPartner())) notFound();

  const [storefront, products, clients, offers, invoices] = await Promise.all([
    getMyStorefront(user.id),
    listMyProducts(user.id),
    listPartnerClients(user.id),
    listMyOffers(user.id),
    listMyInvoices(user.id),
  ]);

  // 정산 요약(파트너 본인) — 상태별 합계.
  const admin = createAdminClient();
  const { data: earnings } = await admin
    .from("partner_earnings")
    .select("amount_krw, gross_krw, base_deduction_krw, status")
    .eq("partner_user_id", user.id);

  const settlement = { gross: 0, baseDeduction: 0, pending: 0, held: 0, paid: 0 };
  for (const e of earnings ?? []) {
    settlement.gross += e.gross_krw ?? 0;
    settlement.baseDeduction += e.base_deduction_krw ?? 0;
    if (e.status === "paid") settlement.paid += e.amount_krw;
    else if (e.status === "held") settlement.held += e.amount_krw;
    else settlement.pending += e.amount_krw;
  }

  return (
    <PartnerSalesView
      storefront={
        storefront
          ? {
              slug: storefront.slug,
              displayName: storefront.display_name,
              logoUrl: storefront.logo_url,
              intro: storefront.intro,
              contact: storefront.contact,
              sellerInfo: storefront.seller_info,
              status: storefront.status,
            }
          : null
      }
      basePrices={{ basic: basePriceForPlan("basic"), pro: basePriceForPlan("pro") }}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        includedServices: p.included_services,
        basePlan: p.base_plan,
        basePriceKrw: p.base_price_krw,
        sellPriceKrw: p.sell_price_krw,
        vatMode: p.vat_mode,
        billingType: p.billing_type,
        billingPeriod: p.billing_period,
        validFrom: p.valid_from,
        validUntil: p.valid_until,
        scope: p.scope,
        terms: p.terms,
        status: p.status,
      }))}
      clients={clients.map((c) => ({
        clientUserId: c.clientUserId,
        label: c.clientName || c.clientEmail || c.clientUserId.slice(0, 8),
      }))}
      offers={offers.map((o) => ({
        id: o.id,
        token: o.token,
        name: o.name,
        sellPriceKrw: o.sell_price_krw,
        basePriceKrw: o.base_price_krw,
        status: o.status,
        createdAt: o.created_at,
      }))}
      invoices={invoices.map((i) => ({
        id: i.id,
        token: i.token,
        number: i.number,
        sellPriceKrw: i.sell_price_krw,
        basePriceKrw: i.base_price_krw,
        status: i.status,
        createdAt: i.created_at,
      }))}
      settlement={settlement}
    />
  );
}
