"use server";

import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import {
  upsertBasePlanCatalog,
  type BasePlanCatalogInput,
} from "@/lib/b2b2c/basePlans";

export async function saveBasePlanAction(
  input: BasePlanCatalogInput,
): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user || !(await isCurrentUserAdmin())) {
    return { error: "권한이 없습니다." };
  }
  return upsertBasePlanCatalog(input, user.id);
}
