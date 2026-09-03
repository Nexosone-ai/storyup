import { createAdminClient } from "@/lib/supabase/server";
import {
  PLANS,
  OVERAGE_COST,
  getPlanById,
  type Plan,
  type PlanId,
} from "@/lib/plans";

/**
 * 구독/월 제공량 조회·소비 — 플랜 정의는 src/lib/plans.ts가 단일 소스.
 * 0012 마이그레이션(subscriptions/usage_events/plan_grants) 적용 전에는
 * 모든 함수가 조용히 실패해 기존(포인트-only) 동작을 유지한다.
 */

export type UsageKind = "site" | "blog_post" | "card_news" | "ai_image";

const PLAN_IDS = new Set(PLANS.map((p) => p.id));

/** 현재 월 기간 — Asia/Seoul 기준 ('YYYY-MM' 키 + 월 시작 시각). */
export function currentPeriod(): { key: string; startIso: string } {
  const now = new Date();
  const seoul = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(now); // "YYYY-MM"
  return { key: seoul, startIso: `${seoul}-01T00:00:00+09:00` };
}

/** 사용자의 현재 플랜. 구독 행이 없거나 조회 실패 시 free. */
export async function getPlanId(userId: string): Promise<PlanId> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data || data.status !== "active") return "free";
  const plan = data.plan as PlanId;
  return PLAN_IDS.has(plan) ? plan : "free";
}

/** 이번 달 플랜 포인트를 아직 안 받았으면 지급 (멱등, 실패 무시). */
export async function ensureMonthlyGrant(
  userId: string,
  planId: PlanId,
): Promise<void> {
  const plan = getPlanById(planId);
  if (plan.monthlyPoints === null || plan.monthlyPoints <= 0) return;
  const admin = createAdminClient();
  const { error } = await admin.rpc("grant_plan_points", {
    p_user: userId,
    p_plan: planId,
    p_period: currentPeriod().key,
    p_amount: plan.monthlyPoints,
  });
  // 마이그레이션 전(함수 없음)이거나 일시 오류 — 서비스는 계속.
  if (error) console.error("[subscription] grant_plan_points", error.message);
}

/** 이번 달(서울 기준) kind별 사용 건수. 조회 실패 시 null. */
export async function countMonthlyUsage(
  userId: string,
  kind: UsageKind,
): Promise<number | null> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", currentPeriod().startIso);
  if (error) return null;
  return count ?? 0;
}

export interface QuotaCharge {
  /** 차감된 포인트 (0 = 월 제공량 내). */
  charged: number;
  /** 생성 실패 시 호출 — 사용량과 차감 포인트를 되돌린다. */
  refund: () => Promise<void>;
}

export class InsufficientPointsError extends Error {
  constructor(ko: boolean, context: "quota" | "charge" = "quota") {
    super(
      context === "quota"
        ? ko
          ? "이번 달 제공량을 모두 사용했고, 추가 생성에 필요한 포인트가 부족합니다. 포인트를 충전하거나 플랜을 업그레이드해주세요."
          : "You've used this month's quota and don't have enough points for extra generations. Top up points or upgrade your plan."
        : ko
          ? "포인트가 부족합니다. 충전 후 이용해주세요."
          : "Not enough points. Please top up and try again.",
    );
    this.name = "InsufficientPointsError";
  }
}

const OVERAGE_BY_KIND: Record<UsageKind, number> = {
  site: OVERAGE_COST.site,
  blog_post: OVERAGE_COST.blogPost,
  card_news: OVERAGE_COST.cardNews,
  ai_image: OVERAGE_COST.aiImage,
};

const KIND_LIMIT: Record<UsageKind, (p: Plan) => number | null> = {
  site: (p) => p.limits.sites,
  blog_post: (p) => p.limits.blogPosts,
  card_news: (p) => p.limits.cardNews,
  ai_image: (p) => p.limits.aiImages,
};

/**
 * 월 제공량 1건 소비. 한도 내면 무료, 초과면 포인트 차감(spend_points).
 * 시스템 미구축(마이그레이션 전) 등으로 판단이 불가능하면 null을 반환해
 * 호출부가 기존 과금 경로로 폴백하게 한다.
 * @param usedOverride kind='site'처럼 월 카운트가 아닌 기준(보유 개수)을 쓸 때 전달.
 */
export async function consumeQuota(
  userId: string,
  kind: UsageKind,
  description: string,
  ko: boolean,
  usedOverride?: number,
): Promise<QuotaCharge | null> {
  const admin = createAdminClient();
  const planId = await getPlanId(userId);
  const plan = getPlanById(planId);
  await ensureMonthlyGrant(userId, planId);

  // usage_events 조회는 가용성 프로브를 겸한다 — 실패(마이그레이션 전)면 레거시 폴백.
  const monthly = await countMonthlyUsage(userId, kind);
  if (monthly === null) return null;

  const limit = KIND_LIMIT[kind](plan);
  let cost = 0;
  if (limit !== null) {
    const used = usedOverride ?? monthly;
    if (used >= limit) cost = OVERAGE_BY_KIND[kind];
  }

  if (cost > 0) {
    const { error } = await admin.rpc("spend_points", {
      p_user: userId,
      p_amount: cost,
      p_reason: description,
      p_type: "AI_USAGE",
      p_ref_type: "quota_overage",
      p_ref_id: null,
    });
    if (error) {
      if (error.message?.includes("INSUFFICIENT_POINTS"))
        throw new InsufficientPointsError(ko);
      console.error("[subscription] spend_points failed", kind, error);
      return null;
    }
  }

  const { data: event, error: evErr } = await admin
    .from("usage_events")
    .insert({ user_id: userId, kind, charged: cost })
    .select("id")
    .single();
  if (evErr)
    console.error("[subscription] usage_events insert failed", kind, evErr);

  return {
    charged: cost,
    refund: async () => {
      if (event?.id)
        await admin.from("usage_events").delete().eq("id", event.id);
      if (cost > 0) {
        const { error: refundErr } = await admin
          .from("point_transactions")
          .insert({
            user_id: userId,
            amount: cost,
            reason: `${description} 실패 — 크레딧 환급`,
            type: "REFUND",
            ref_type: "service_refund",
          });
        if (refundErr)
          console.error("[subscription] refund failed", kind, refundErr);
      }
    },
  };
}

// ---------------- 대시보드 표시용 ----------------

export interface SubscriptionOverview {
  planId: PlanId;
  plan: Plan;
  usage: { blogPosts: number; cardNews: number; aiImages: number };
  /** 보유 랜딩페이지 수 (websites 행 기준). */
  sites: number;
}

export async function getSubscriptionOverview(
  userId: string,
): Promise<SubscriptionOverview> {
  const planId = await getPlanId(userId);
  await ensureMonthlyGrant(userId, planId);
  const [blogPosts, cardNews, aiImages, sites] = await Promise.all([
    countMonthlyUsage(userId, "blog_post"),
    countMonthlyUsage(userId, "card_news"),
    countMonthlyUsage(userId, "ai_image"),
    countUserWebsites(userId),
  ]);
  return {
    planId,
    plan: getPlanById(planId),
    usage: {
      blogPosts: blogPosts ?? 0,
      cardNews: cardNews ?? 0,
      aiImages: aiImages ?? 0,
    },
    sites,
  };
}

/** 사용자가 보유한 랜딩페이지(websites) 수. */
export async function countUserWebsites(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: businesses } = await admin
    .from("businesses")
    .select("id")
    .eq("user_id", userId);
  const ids = (businesses ?? []).map((b) => b.id);
  if (ids.length === 0) return 0;
  const { count } = await admin
    .from("websites")
    .select("id", { count: "exact", head: true })
    .in("business_id", ids);
  return count ?? 0;
}
