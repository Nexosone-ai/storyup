"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import {
  upsertHqProduct,
  setHqProductStatus,
  type HqProductInput,
} from "@/lib/hq/products";

/** 관리자 전용 — 본사 상품 생성/수정. 변경은 이후 저장되는 파트너 상품부터 적용(기존 스냅샷 불변). */
export async function saveHqProductAction(
  input: HqProductInput,
): Promise<{ id?: string; error?: string }> {
  const user = await getUser();
  if (!user || !(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const res = await upsertHqProduct(input, user.id);
  revalidatePath("/dashboard/admin/hq-products");
  revalidatePath("/partner/sales");
  return res;
}

/** 관리자 전용 — 판매 시작(active)/중지(draft)/보관(archived). 삭제는 없다. */
export async function setHqProductStatusAction(
  id: string,
  status: "draft" | "active" | "archived",
): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user || !(await isCurrentUserAdmin())) return { error: "권한이 없습니다." };
  const res = await setHqProductStatus(id, status);
  revalidatePath("/dashboard/admin/hq-products");
  revalidatePath("/partner/sales");
  return res;
}
