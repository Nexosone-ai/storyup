import { createAdminClient } from "@/lib/supabase/server";
import {
  PLANS,
  getPlanById,
  legacyPlanFor,
  PLAN_TERMS_CUTOVER_ISO,
  type Plan,
  type PlanId,
} from "@/lib/plans";
import { upsellSentence } from "@/lib/upsell";

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

export interface SubscriptionTerms {
  planId: PlanId;
  /** 전환일(PLAN_TERMS_CUTOVER_ISO) 이전에 시작한 구독이 현재 기간을 끝내기 전 → 이전 조건 유지. */
  legacy: boolean;
}

const CUTOVER_MS = Date.parse(PLAN_TERMS_CUTOVER_ISO);
/** 전환 시점에 진행 중이던 기간의 만기 상한(월 구독 + 여유). 갱신으로 이보다 뒤로 밀리면 현행 조건. */
const LEGACY_PERIOD_END_MAX_MS = CUTOVER_MS + 35 * 24 * 60 * 60 * 1000;

/**
 * 사용자의 현재 플랜 + 이전 조건 유지 여부. 구독 행이 없거나 조회 실패, 기간 만료 시 free.
 * 이전 조건(legacy): Basic·Pro 이고 created_at < 전환일 이며, 만기(current_period_end)가
 * 없거나(관리자 부여·무기한) 전환 시점 기간 안(전환일+35일 이내)일 때. 갱신되면 해제.
 */
export async function getSubscriptionTerms(
  userId: string,
): Promise<SubscriptionTerms> {
  const admin = createAdminClient();
  // 직원 계정이면 소유자의 플랜을 상속한다(0044 account_owner_id).
  const { data: ownerData } = await admin.rpc("account_owner_id", {
    p_user: userId,
  });
  const effectiveId =
    typeof ownerData === "string" && ownerData ? ownerData : userId;
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan, status, current_period_end, created_at")
    .eq("user_id", effectiveId)
    .maybeSingle();
  const free: SubscriptionTerms = { planId: "free", legacy: false };
  if (error || !data || data.status !== "active") return free;
  // 기간이 지난 구독(체험 종료·갱신 실패)은 크론 처리 전이라도 free로 취급
  const endMs = data.current_period_end
    ? new Date(data.current_period_end).getTime()
    : null;
  if (endMs !== null && endMs < Date.now()) return free;
  const plan = data.plan as PlanId;
  if (!PLAN_IDS.has(plan)) return free;
  const createdMs = data.created_at ? new Date(data.created_at).getTime() : NaN;
  const legacy =
    (plan === "basic" || plan === "pro") &&
    Number.isFinite(createdMs) &&
    createdMs < CUTOVER_MS &&
    (endMs === null || endMs <= LEGACY_PERIOD_END_MAX_MS);
  return { planId: plan, legacy };
}

/** 사용자의 현재 플랜 id. 구독 행이 없거나 조회 실패, 기간 만료 시 free. */
export async function getPlanId(userId: string): Promise<PlanId> {
  return (await getSubscriptionTerms(userId)).planId;
}

/**
 * 사용자에게 실제 적용되는 플랜 객체 — 한도·사업장·레이아웃·이미지 화질 판정은 이걸 써야 한다.
 * 전환 전 구독자는 만기까지 legacyPlanFor() 조건, 그 외는 getPlanById().
 */
export async function getUserPlan(userId: string): Promise<Plan> {
  const t = await getSubscriptionTerms(userId);
  return t.legacy ? legacyPlanFor(t.planId) : getPlanById(t.planId);
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

/**
 * 쿼터 조회 — 쇼츠(카드뉴스 배경 영상) 생성. 플랜별 월 제한(plans.limits.shorts)과
 * 이번 달(서울 기준) 사용량을 함께 돌려준다. limit=0은 미제공(Free), null은 무제한(Partner).
 */
export async function getShortsQuota(
  userId: string,
): Promise<{ planId: PlanId; limit: number | null; used: number }> {
  const plan = await getUserPlan(userId);
  const planId = plan.id;
  const limit = plan.limits.shorts;
  const admin = createAdminClient();
  const { count } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "shorts")
    .gte("created_at", currentPeriod().startIso);
  return { planId, limit, used: count ?? 0 };
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
  // 무료 블로그는 이제 월 이용권(freeAccess)으로 관리하므로 평생 누적 대상은 카드뉴스만.
  return planId === "free" && kind === "card_news";
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
  /** 차감된 포인트 — 플랜 제공량(랜딩·블로그·카드뉴스·이미지)은 UP을 쓰지 않으므로 항상 0. */
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
          ? `이번 달 제공량을 모두 사용했고, 추가 생성에 필요한 UP이 부족합니다. ${upsellSentence(true)}`
          : `You've used this month's quota and don't have enough UP for extra generations. ${upsellSentence(false)}`
        : ko
          ? `UP이 부족합니다. ${upsellSentence(true)}`
          : `Not enough UP. ${upsellSentence(false)}`) + suffix,
    );
    this.name = "InsufficientPointsError";
  }
}

/**
 * 플랜 제공량 초과 — 랜딩페이지·블로그·카드뉴스·AI 이미지는 UP으로 추가 구매하지 않는다
 * (UP은 AI 영상 전용). 한도에 닿으면 생성을 막고 담당 파트너 문의(업세일)로 안내한다.
 * 기존 호출부(instanceof InsufficientPointsError → 402/에러 메시지)를 그대로 타도록 하위 클래스로 둔다.
 */
export class PlanLimitError extends InsufficientPointsError {
  constructor(
    public readonly kind: UsageKind,
    public readonly limit: number,
    ko: boolean,
  ) {
    super(ko, "quota");
    const n = limit.toLocaleString();
    const tail = upsellSentence(ko);
    this.message =
      kind === "site"
        ? ko
          ? `랜딩페이지는 현재 플랜에 ${n}개 포함돼 있고 이미 모두 사용 중이에요. 다른 비즈니스에 랜딩페이지를 더 만들려면 ${tail}`
          : `Your plan includes ${n} landing page(s) and they are all in use. ${tail}`
        : kind === "blog_post"
          ? ko
            ? `이번 달 블로그 제공량(${n}개)을 모두 사용했어요. ${tail}`
            : `You've used this month's blog quota (${n}). ${tail}`
          : kind === "card_news"
            ? ko
              ? `이번 달 카드뉴스 제공량(${n}개)을 모두 사용했어요. ${tail}`
              : `You've used this month's card news quota (${n}). ${tail}`
            : ko
              ? `이번 달 AI 이미지 제공량(${n}장)을 모두 사용했어요. ${tail}`
              : `You've used this month's AI image quota (${n}). ${tail}`;
    this.name = "PlanLimitError";
  }
}

/**
 * kind → service_prices.service 키 매핑. (billing.ts QUOTA_KIND의 역방향)
 * 제공량 초과분을 UP으로 과금하던 시절의 키 — 지금은 표시·관리 화면 참조용으로만 남는다.
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
 * 플랜 제공량 1건 소비. 한도 내면 사용량 기록 후 통과, 한도에 닿았으면 PlanLimitError.
 * 제공량 초과분을 UP으로 자동 차감하지 않는다(UP은 AI 영상 전용, 2026-11-13 결정) —
 * 추가 이용은 담당 파트너 문의(업세일)로 안내한다.
 * usage_events 조회가 실패(마이그레이션 전)하면 null을 반환해 호출부가 판단한다.
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
  const plan = await getUserPlan(userId);
  const planId = plan.id;

  // usage_events 조회는 가용성 프로브를 겸한다 — 실패(마이그레이션 전)면 레거시 폴백.
  // 무료 플랜의 블로그·카드뉴스는 누적, 그 외는 월간 기준으로 카운트한다.
  const consumed = await countPlanUsage(userId, planId, kind);
  if (consumed === null) return null;

  const limit = KIND_LIMIT[kind](plan);
  if (limit !== null) {
    const used = usedOverride ?? consumed;
    // 한도 도달 — UP 차감 없이 막고 파트너 문의로 안내(랜딩 2개째·월 제공량 소진).
    if (used >= limit) throw new PlanLimitError(kind, limit, ko);
  }

  const { data: event, error: evErr } = await admin
    .from("usage_events")
    .insert({ user_id: userId, kind, charged: 0 })
    .select("id")
    .single();
  if (evErr)
    console.error("[subscription] usage_events insert failed", kind, evErr);

  return {
    charged: 0,
    refund: async () => {
      if (event?.id)
        await admin.from("usage_events").delete().eq("id", event.id);
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
  const plan = await getUserPlan(userId);
  const planId = plan.id;
  const [blogPosts, cardNews, aiImages, sites] = await Promise.all([
    countPlanUsage(userId, planId, "blog_post"),
    countPlanUsage(userId, planId, "card_news"),
    countPlanUsage(userId, planId, "ai_image"),
    countUserWebsites(userId),
  ]);
  return {
    planId,
    plan,
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
