import { redirect } from "next/navigation";

/** 옛 '본사 기본상품'(Basic/Pro 공급가) 화면 — 본사 상품(hq_products) 관리로 통합(0112·PR3). */
export default function AdminBasePlansPage() {
  redirect("/dashboard/admin/hq-products");
}
