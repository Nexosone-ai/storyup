"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { disconnectFacebook } from "@/lib/social/facebook";

/** 연결된 Facebook 페이지 해제(소유자만). */
export async function disconnectFacebookAction(
  businessId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: ko ? "로그인이 필요합니다." : "Please log in." };
  const business = await getBusiness(businessId);
  if (!business) return { error: ko ? "권한이 없습니다." : "No permission." };
  await disconnectFacebook(businessId);
  revalidatePath(`/business/${businessId}/agent`);
  return { ok: true };
}
