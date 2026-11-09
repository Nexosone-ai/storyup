"use server";

import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import {
  upsertBasePlanCatalog,
  deleteBasePlanCatalog,
  type BasePlanCatalogInput,
} from "@/lib/b2b2c/basePlans";
import type { SellableBasePlan } from "@/lib/b2b2c/config";

export async function saveBasePlanAction(
  input: BasePlanCatalogInput,
): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user || !(await isCurrentUserAdmin())) {
    return { error: "권한이 없습니다." };
  }
  return upsertBasePlanCatalog(input, user.id);
}

/** 설정 행 삭제 → plans.ts 기본값으로 되돌림(파트너 상품 스냅샷은 유지). */
export async function deleteBasePlanAction(
  plan: SellableBasePlan,
): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user || !(await isCurrentUserAdmin())) {
    return { error: "권한이 없습니다." };
  }
  return deleteBasePlanCatalog(plan);
}
