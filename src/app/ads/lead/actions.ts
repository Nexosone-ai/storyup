"use server";

import { submitAdLead } from "@/lib/ads/leads";
import { ADS_ENABLED } from "@/lib/ads/config";

/** CPA 리드 제출(방문자, 로그인 불필요). */
export async function submitAdLeadAction(
  placementId: string,
  input: { name: string; phone: string; message?: string },
): Promise<{ ok?: boolean; error?: string; message?: string }> {
  if (!ADS_ENABLED) return { error: "광고 서비스 준비중입니다." };
  return submitAdLead({
    placementId,
    name: input.name,
    phone: input.phone,
    message: input.message,
  });
}
