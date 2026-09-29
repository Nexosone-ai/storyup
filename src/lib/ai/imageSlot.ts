import type { createClient } from "@/lib/supabase/server";
import { getPlanId } from "@/lib/subscription";
import type { PlanId } from "@/lib/plans";

/**
 * 동일 이미지 슬롯의 AI 재생성 남용 방지.
 * 이미지는 딜리버리에 포함(무과금)이라, 비용/남용은 "같은 슬롯 생성 횟수"로만 막는다.
 * 슬롯 키 예: 랜딩=콘텐츠 경로("hero", "gallery.2"), 카드뉴스="card:{postId}:{index}", 블로그="body:{headingIdx}".
 */

type DbClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 슬롯당 AI 이미지 생성 총 횟수 상한(최초 생성 포함). 플랜별.
 * 예) free=2 → 최초 1회 + 재생성 1회. 초과 시 그 슬롯 재생성 차단(업로드·직접 편집은 무관).
 */
export const IMAGE_SLOT_LIMIT: Record<PlanId, number> = {
  free: 2,
  basic: 3,
  pro: 10,
  partner: 50,
};

/**
 * 슬롯을 원자적으로 예약한다. 플랜 한도 미만이면 +1 하고 true, 도달했으면 false.
 * 카운터 인프라 오류 시에는 정상 생성을 막지 않도록 true를 반환한다(가용성 우선).
 */
export async function reserveImageSlot(
  supabase: DbClient,
  userId: string,
  businessId: string,
  slotKey: string,
): Promise<boolean> {
  const planId = await getPlanId(userId);
  const limit = IMAGE_SLOT_LIMIT[planId] ?? IMAGE_SLOT_LIMIT.free;
  const { data, error } = await supabase.rpc("try_reserve_image_slot", {
    p_business: businessId,
    p_slot: (slotKey || "default").slice(0, 200),
    p_limit: limit,
  });
  if (error) {
    console.error("[imageSlot] reserve failed", error);
    return true;
  }
  return data === true;
}

/** 생성 실패 시 예약 반환(카운트 -1). 실패해도 조용히 무시. */
export async function releaseImageSlot(
  supabase: DbClient,
  businessId: string,
  slotKey: string,
): Promise<void> {
  const { error } = await supabase.rpc("release_image_slot", {
    p_business: businessId,
    p_slot: (slotKey || "default").slice(0, 200),
  });
  if (error) console.error("[imageSlot] release failed", error);
}
