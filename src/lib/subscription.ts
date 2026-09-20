import { createAdminClient } from "@/lib/supabase/server";
import { PLANS, getPlanById, type Plan, type PlanId } from "@/lib/plans";
import { getServicePrice } from "@/lib/payments/prices";

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

/** 사용자의 현재 플랜. 구독 행이 없거나 조회 실패, 기간 만료 시 free. */
export async function getPlanId(userId: string): Promise<PlanId> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data || data.status !== "active") return "free";
  // 기간이 지난 구독(체험 종료·갱신 실패)은 크론 처리 전이라도 free로 취급
  if (
    data.current_period_end &&
    new Date(data.current_period_end).getTime() < Date.now()
  )
    return "free";
  const plan = data.plan as PlanId;
  return PLAN_IDS.has(plan) ? plan : "free";
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

/** 전체 기간 kind별 누적 사용 건수 (무료 플랜의 평생 총량 제한용). 조회 실패 시 null. */
export async function countTotalUsage(
  userId: string,
  kind: UsageKind,
): Promise<number | null> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind);
  if (error) return null;
  return count ?? 0;
}

/**
 * 무료 플랜의 블로그·카드뉴스는 월 갱신이 아닌 평생 총량으로 제한한다.
 * (표기도 "/월" 없이 총 제공량으로 노출 — src/lib/plans.ts)
 */
export function isLifetimeQuota(planId: PlanId, kind: UsageKind): boolean {
  return planId === "free" && (kind === "blog_post" || kind === "card_news");
}

/** 플랜·kind에 맞는 사용 건수(무료 블로그·카드뉴스는 누적, 그 외 월간). */
export function countPlanUsage(
  userId: string,
  planId: PlanId,
  kind: UsageKind,
): Promise<number | null> {
  return isLifetimeQuota(planId, kind)
    ? countTotalUsage(userId, kind)
    : countMonthlyUsage(userId, kind);
}

export interface QuotaCharge {
  /** 차감된 포인트 (0 = 월 제공량 내). */
  charged: number;
  /** 생성 실패 시 호출 — 사용량과 차감 포인트를 되돌린다. */
  refund: () => Promise<void>;
}

export class InsufficientPointsError extends Error {
  constructor(
    ko: boolean,
    context: "quota" | "charge" = "quota",
    detail?: { needed: number; balance: number },
  ) {
    const suffix = detail
      ? ko
        ? ` (필요 ${detail.needed.toLocaleString()} UP · 보유 ${detail.balance.toLocaleString()} UP)`
        : ` (needs ${detail.needed.toLocaleString()} UP · you have ${detail.balance.toLocaleString()} UP)`
      : "";
    super(
      (context === "quota"
        ? ko
          ? "이번 달 제공량을 모두 사용했고, 추가 생성에 필요한 UP이 부족합니다. 플랜을 업그레이드해주세요."
          : "You've used this month's quota and don't have enough UP for extra generations. Please upgrade your plan."
        : ko
          ? "UP이 부족합니다. 플랜을 업그레이드해주세요."
          : "Not enough UP. Please upgrade your plan.") + suffix,
    );
    this.name = "InsufficientPointsError";
  }
}

/**
 * 제공량 초과분 과금은 관리자 화면(service_prices)을 단일 소스로 쓴다.
 * kind → service_prices.service 키 매핑. (billing.ts QUOTA_KIND의 역방향)
 */
export const SERVICE_BY_KIND: Record<UsageKind, string> = {
  site: "AI_WEBSITE",
  blog_post: "AI_BLOG",
  card_news: "CARD_NEWS",
  ai_image: "IMAGE_GENERATION",
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

  // usage_events 조회는 가용성 프로브를 겸한다 — 실패(마이그레이션 전)면 레거시 폴백.
  // 무료 플랜의 블로그·카드뉴스는 누적, 그 외는 월간 기준으로 카운트한다.
  const consumed = await countPlanUsage(userId, planId, kind);
  if (consumed === null) return null;

  const limit = KIND_LIMIT[kind](plan);
  let cost = 0;
  if (limit !== null) {
    const used = usedOverride ?? consumed;
    // 초과분 단가는 관리자 화면(service_prices)에서 조회 — 0이면 무료.
    if (used >= limit) cost = await getServicePrice(SERVICE_BY_KIND[kind]);
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
      if (error.message?.includes("INSUFFICIENT_POINTS")) {
        // 사용자에게 필요한 UP과 현재 잔액을 함께 알려준다
        const { data: txs } = await admin
          .from("point_transactions")
          .select("amount")
          .eq("user_id", userId);
        const balance = (txs ?? []).reduce((s, t) => s + t.amount, 0);
        throw new InsufficientPointsError(ko, "quota", { needed: cost, balance });
      }
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
  const [blogPosts, cardNews, aiImages, sites] = await Promise.all([
    countPlanUsage(userId, planId, "blog_post"),
    countPlanUsage(userId, planId, "card_news"),
    countPlanUsage(userId, planId, "ai_image"),
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
