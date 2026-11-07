import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { getPlanById, type PlanId } from "@/lib/plans";
import { countMonthlyUsage, getPlanId } from "@/lib/subscription";

/**
 * 무료 플랜 AI 이미지 월 한도 (plans.limits.aiImages, free=30).
 * 유료 플랜은 제한 없음(딜리버리 포함). 사용량은 usage_events(kind='ai_image', 서울 기준 월)로
 * 센다 — 0012 테이블·kind 그대로 재사용, 마이그레이션 불필요.
 *
 * 사용: 생성 전 reserveFreeImage() → 실패 시 release()로 되돌린다.
 * 카운트→삽입이 원자적이진 않아 동시 클릭으로 1~2장 넘길 수 있으나 비용 상한용이라 허용.
 */

export interface ImageReservation {
  ok: true;
  /** 생성 실패 시 사용량 반환. */
  release: () => Promise<void>;
}
export interface ImageQuotaExceeded {
  ok: false;
  error: string;
  limit: number;
}

export function freeImageLimit(): number {
  return getPlanById("free").limits.aiImages ?? 0;
}

export function imageQuotaMessage(ko: boolean, limit: number): string {
  return ko
    ? `무료 플랜의 AI 이미지는 월 ${limit}장까지예요. 이번 달 한도를 모두 사용했어요. 직접 업로드하거나 다음 달에 다시 생성해주세요. 유료 플랜은 제한 없이 생성할 수 있어요.`
    : `The free plan includes ${limit} AI images per month and you've used them all. Upload your own image or upgrade for unlimited AI images.`;
}

/**
 * 무료 플랜이면 이번 달 사용량을 확인해 1장을 예약한다. 유료는 항상 ok(기록 없음).
 * planId를 넘기면 재조회하지 않는다.
 */
export async function reserveFreeImage(
  userId: string,
  opts?: { planId?: PlanId; ko?: boolean },
): Promise<ImageReservation | ImageQuotaExceeded> {
  const planId = opts?.planId ?? (await getPlanId(userId));
  if (planId !== "free") return { ok: true, release: async () => {} };

  const limit = freeImageLimit();
  const used = await countMonthlyUsage(userId, "ai_image");
  // 카운트 조회 실패(인프라)는 생성을 막지 않는다(가용성 우선).
  if (used !== null && used >= limit)
    return { ok: false, error: imageQuotaMessage(opts?.ko ?? true, limit), limit };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usage_events")
    .insert({ user_id: userId, kind: "ai_image", charged: 0 })
    .select("id")
    .single();
  if (error) console.error("[imageQuota] usage insert failed", error);
  return {
    ok: true,
    release: async () => {
      if (data?.id) await admin.from("usage_events").delete().eq("id", data.id);
    },
  };
}

/** 무료 플랜 남은 장수(표시용). 유료는 null(무제한). */
export async function freeImageRemaining(
  userId: string,
  planId?: PlanId,
): Promise<number | null> {
  const plan = planId ?? (await getPlanId(userId));
  if (plan !== "free") return null;
  const used = (await countMonthlyUsage(userId, "ai_image")) ?? 0;
  return Math.max(freeImageLimit() - used, 0);
}
