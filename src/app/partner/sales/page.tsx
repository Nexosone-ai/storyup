import { notFound } from "next/navigation";
import { getUser } from "@/lib/queries";
import { isCurrentUserPartner, isSubPartner, listPartnerClients } from "@/lib/partner";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { listHqProducts, stripSupplyPrice } from "@/lib/hq/products";
import { describeFulfillment } from "@/lib/partner/entitlementCatalog";
import { getMyStorefront } from "@/lib/b2b2c/storefront";
import { listMyProducts, listParentProductsFor } from "@/lib/b2b2c/products";
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

  // 서브파트너에게는 본사 상품(공급가·구성)을 노출하지 않는다 —
  // 서브의 원가는 상위파트너 판매가뿐이므로 본사 상품을 조회조차 하지 않는다.
  const amSub = await isSubPartner(user.id);

  const [
    storefront,
    products,
    clients,
    offers,
    invoices,
    hqProducts,
    parentProducts,
  ] = await Promise.all([
    getMyStorefront(user.id),
    listMyProducts(user.id),
    listPartnerClients(user.id),
    listMyOffers(user.id),
    listMyInvoices(user.id),
    amSub ? Promise.resolve([]) : listHqProducts({ activeOnly: true }),
    listParentProductsFor(user.id),
  ]);

  // 정산 요약(파트너 본인) — 상태별 합계.
  const admin = createAdminClient();
  const { data: earnings } = await admin
    .from("partner_earnings")
    .select("amount_krw, gross_krw, status")
    .eq("partner_user_id", user.id);

  // 원가 공제액·플랫폼 수수료는 파트너 화면에 내려보내지 않는다(원가 역산 방지, 2026-11-11).
  const settlement = { gross: 0, pending: 0, held: 0, paid: 0 };
  for (const e of earnings ?? []) {
    settlement.gross += e.gross_krw ?? 0;
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
      hqProducts={hqProducts.map(stripSupplyPrice).map((h) => ({
        id: h.id,
        name: h.name,
        description: h.description,
        includedServices: h.includedServices,
        // '결제 시 제공' 불릿(파트너 문구) — 공급가 없음.
        fulfillment: describeFulfillment(
          h.items,
          h.grantPlan ? { plan: h.grantPlan, days: h.grantDays } : null,
          "partner",
        ),
      }))}
      isSub={amSub}
      parentProducts={parentProducts.map((p) => ({
        id: p.id,
        name: p.name,
        basePlan: p.basePlan,
        includedServices: p.includedServices,
      }))}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        includedServices: p.included_services,
        basePlan: p.base_plan,
        hqProductId: p.hq_product_id,
        parentProductId: p.parent_product_id,
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
        status: o.status,
        createdAt: o.created_at,
      }))}
      invoices={invoices.map((i) => ({
        id: i.id,
        token: i.token,
        number: i.number,
        sellPriceKrw: i.sell_price_krw,
        status: i.status,
        createdAt: i.created_at,
      }))}
      settlement={settlement}
    />
  );
}
