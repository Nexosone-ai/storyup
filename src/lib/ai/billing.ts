import { createAdminClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import {
  consumeQuota,
  countUserWebsites,
  InsufficientPointsError,
  type UsageKind,
} from "@/lib/subscription";

/**
 * AI 서비스 과금 — 모든 AI 라우트가 공용으로 사용한다.
 * 1) 요금제 월 제공량(usage_events) 우선: 한도 내 무료, 초과분은 포인트 차감.
 * 2) 0012 마이그레이션 전이거나 제공량 대상이 아닌 서비스는
 *    기존 service_prices(관리자 구성) 경로로 과금한다.
 * 차감은 DB 함수 spend_points(advisory lock)로 동시 요청 이중지출을 막는다.
 */

export { InsufficientPointsError };

export interface AiBilling {
  charged: number;
  /** AI 작업 실패 시 호출 — 차감분(및 사용량)을 되돌린다. */
  refund: () => Promise<void>;
}

const noop: AiBilling = { charged: 0, refund: async () => {} };

/** 월 제공량이 적용되는 서비스 → 사용량 종류. */
const QUOTA_KIND: Record<string, UsageKind> = {
  AI_BLOG: "blog_post",
  CARD_NEWS: "card_news",
  IMAGE_GENERATION: "ai_image",
};

export async function chargeAiUsage(
  userId: string,
  service: string,
  description: string,
): Promise<AiBilling> {
  const ko = (await getLocale()) === "ko";

  const kind = QUOTA_KIND[service];
  if (kind) {
    const quota = await consumeQuota(userId, kind, description, ko);
    if (quota) return quota;
    // null = 제공량 시스템 미구축 → 레거시 경로로 폴백
  }

  return chargeLegacy(userId, service, description, ko);
}

/**
 * AI 랜딩페이지 생성 과금 — 랜딩페이지 한도는 월 건수가 아니라 "보유 개수" 기준.
 * 같은 비즈니스의 재생성은 제공량을 소비하지 않는다.
 */
export async function chargeWebsiteGeneration(
  userId: string,
  businessId: string,
  description: string,
): Promise<AiBilling> {
  const ko = (await getLocale()) === "ko";
  const admin = createAdminClient();

  const { data: existing, error } = await admin
    .from("websites")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!error && existing) return noop; // 재생성 — 이미 보유분

  const owned = await countUserWebsites(userId);
  const quota = await consumeQuota(userId, "site", description, ko, owned);
  if (quota) return quota;

  return chargeLegacy(userId, "AI_WEBSITE", description, ko);
}

/** 기존 service_prices 기반 과금. 가격 0원/비활성/미설정 = 무료. */
async function chargeLegacy(
  userId: string,
  service: string,
  description: string,
  ko: boolean,
): Promise<AiBilling> {
  const admin = createAdminClient();
  const { data: priceRow, error: priceErr } = await admin
    .from("service_prices")
    .select("price, active")
    .eq("service", service)
    .maybeSingle();

  // 가격 테이블이 아직 없거나(마이그레이션 전) 미설정/비활성/0원 → 무료
  if (priceErr || !priceRow || !priceRow.active || priceRow.price <= 0)
    return noop;

  const price = priceRow.price;
  const { error } = await admin.rpc("spend_points", {
    p_user: userId,
    p_amount: price,
    p_reason: description,
    p_type: "AI_USAGE",
    p_ref_type: "service",
    p_ref_id: null,
  });
  if (error) {
    if (error.message?.includes("INSUFFICIENT_POINTS")) {
      const { data: txs } = await admin
        .from("point_transactions")
        .select("amount")
        .eq("user_id", userId);
      const balance = (txs ?? []).reduce((s, t) => s + t.amount, 0);
      throw new InsufficientPointsError(ko, "charge", { needed: price, balance });
    }
    console.error("[billing] spend_points failed", service, error);
    // 과금 인프라 오류로 서비스 자체를 막지는 않는다 (감사 로그만 남김)
    return noop;
  }

  return {
    charged: price,
    refund: async () => {
      const { error: refundErr } = await admin
        .from("point_transactions")
        .insert({
          user_id: userId,
          amount: price,
          reason: `${description} 실패 — 크레딧 환급`,
          type: "REFUND",
          ref_type: "service_refund",
        });
      if (refundErr)
        console.error("[billing] refund failed", service, refundErr);
    },
  };
}
