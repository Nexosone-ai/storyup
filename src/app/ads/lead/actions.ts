"use server";

import { submitAdLead } from "@/lib/ads/leads";

/** CPA 리드 제출(방문자, 로그인 불필요). */
export async function submitAdLeadAction(
  placementId: string,
  input: { name: string; phone: string; message?: string },
): Promise<{ ok?: boolean; error?: string; message?: string }> {
  return submitAdLead({
    placementId,
    name: input.name,
    phone: input.phone,
    message: input.message,
  });
}
