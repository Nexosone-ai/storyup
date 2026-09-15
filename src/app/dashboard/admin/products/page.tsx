import {
  listProductsAdmin,
  listProductOrdersAdmin,
} from "@/lib/payments/orders";
import {
  AdminProducts,
  AdminProductOrders,
} from "@/components/admin/AdminProductsView";

export const metadata = { title: "관리자 · 상품·주문" };

export default async function AdminProductsPage() {
  const [products, productOrders] = await Promise.all([
    listProductsAdmin(),
    listProductOrdersAdmin(),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.storyup.me";

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <AdminProducts
        siteUrl={siteUrl}
        products={products.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description ?? "",
          price: p.price,
          imageUrl: p.image_url ?? "",
          detailImageUrl: p.detail_image_url ?? "",
          active: p.active,
          sortOrder: p.sort_order,
          grantsPlan: p.grants_plan ?? "",
          grantDays: p.grant_days,
        }))}
      />
      <AdminProductOrders
        orders={productOrders.map((o) => ({
          id: o.id,
          created_at: o.created_at,
          productName: o.product_name,
          buyerName: o.buyer_name ?? "",
          buyerContact: [o.buyer_phone, o.buyer_email]
            .filter(Boolean)
            .join(" · "),
          amount: o.amount,
          method: o.payment_method ?? "",
          status: o.status,
        }))}
      />
    </div>
  );
}
