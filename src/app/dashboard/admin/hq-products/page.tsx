import { listHqProducts } from "@/lib/hq/products";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { AdminHqProductsView } from "@/components/admin/AdminHqProductsView";

export const metadata = { title: "본사 상품" };

// 관리자 레이아웃이 admin 가드. 여기선 데이터만 로드(공급가 포함 — 관리자 전용 화면).
export default async function AdminHqProductsPage() {
  const products = await listHqProducts();
  return <AdminHqProductsView enabled={B2B2C_ENABLED} products={products} />;
}
