import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { getPlanById, type Plan, type PlanId } from "@/lib/plans";
import { countMonthlyUsage, getUserPlan } from "@/lib/subscription";
import { upsellSentence } from "@/lib/upsell";

/**
 * AI 이미지 월 한도 (plans.limits.aiImages — Free 30 · Basic 100 · Pro 300 · Partner 무제한).
 * 사용량은 usage_events(kind='ai_image', 서울 기준 월)로 센다 — 0012 테이블·kind 그대로 재사용,
 * 마이그레이션 불필요. 한도 초과 시 생성이 막히고 안내(B2B2C: 담당 파트너 문의)가 나간다.
 *
 * 사용: 생성 전 reserveImageQuota() → 실패 시 release()로 되돌린다.
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

function resolvePlan(p: Plan | PlanId): Plan {
  return typeof p === "string" ? getPlanById(p) : p;
}

/** 플랜의 월 한도(null = 무제한). Plan 객체를 넘기면 이전 조건(legacy)도 반영된다. */
export function imageLimitFor(plan: Plan | PlanId): number | null {
  return resolvePlan(plan).limits.aiImages;
}

export function imageQuotaMessage(ko: boolean, limit: number, planId: PlanId): string {
  if (planId === "free")
    return ko
      ? `무료 플랜의 AI 이미지는 월 ${limit}장까지예요. 이번 달 한도를 모두 사용했어요. 직접 업로드하거나 다음 달에 다시 생성해주세요. 유료 플랜은 더 많이 생성할 수 있어요.`
      : `The free plan includes ${limit} AI images per month and you've used them all. Upload your own image or upgrade for more.`;
  return ko
    ? `이번 달 AI 이미지 한도(${limit}장)를 모두 사용했어요. 직접 업로드하거나 다음 달에 다시 생성해주세요. ${upsellSentence(true)}`
    : `You've used this month's AI image limit (${limit}). Upload your own image or try again next month. ${upsellSentence(false)}`;
}

/**
 * 플랜에 월 한도가 있으면 이번 달 사용량을 확인해 1장을 예약한다. 무제한(Partner·전환 전 구독)은 항상 ok(기록 없음).
 * plan(getUserPlan 결과)을 넘기면 재조회하지 않는다.
 */
export async function reserveImageQuota(
  userId: string,
  opts?: { plan?: Plan | PlanId; ko?: boolean },
): Promise<ImageReservation | ImageQuotaExceeded> {
  const plan = opts?.plan ? resolvePlan(opts.plan) : await getUserPlan(userId);
  const planId = plan.id;
  const limit = imageLimitFor(plan);
  if (limit === null) return { ok: true, release: async () => {} };

  const used = await countMonthlyUsage(userId, "ai_image");
  // 카운트 조회 실패(인프라)는 생성을 막지 않는다(가용성 우선).
  if (used !== null && used >= limit)
    return { ok: false, error: imageQuotaMessage(opts?.ko ?? true, limit, planId), limit };

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

/** 남은 장수(표시용). 무제한 플랜은 null. */
export async function imageRemaining(
  userId: string,
  plan?: Plan | PlanId,
): Promise<number | null> {
  const limit = imageLimitFor(plan ? resolvePlan(plan) : await getUserPlan(userId));
  if (limit === null) return null;
  const used = (await countMonthlyUsage(userId, "ai_image")) ?? 0;
  return Math.max(limit - used, 0);
}
