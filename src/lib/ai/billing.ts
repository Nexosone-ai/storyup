import { createAdminClient } from "@/lib/supabase/server";

/**
 * AI 서비스 크레딧 과금 — 모든 AI 라우트가 공용으로 사용한다.
 * 가격은 service_prices(관리자 구성)에서 서버가 결정하고,
 * 차감은 DB 함수 spend_points(advisory lock)로 동시 요청 이중지출을 막는다.
 * 가격 0원/비활성/미설정 = 무료 (기존 동작 유지).
 */

export class InsufficientPointsError extends Error {
  constructor() {
    super("포인트가 부족합니다. 충전 후 이용해주세요.");
    this.name = "InsufficientPointsError";
  }
}

export interface AiBilling {
  charged: number;
  /** AI 작업 실패 시 호출 — 차감분을 환급한다. */
  refund: () => Promise<void>;
}

const noop: AiBilling = { charged: 0, refund: async () => {} };

export async function chargeAiUsage(
  userId: string,
  service: string,
  description: string,
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
    if (error.message?.includes("INSUFFICIENT_POINTS"))
      throw new InsufficientPointsError();
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
