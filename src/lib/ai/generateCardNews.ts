import type { SupabaseClient } from "@supabase/supabase-js";
import { upsellSentence } from "@/lib/upsell";
import type { Database } from "@/types/database";
import type { CardNewsResult } from "@/types/domain";
import type { PromptLanguage } from "@/lib/ai/prompts/brand-story";
import { getAIProvider } from "@/lib/ai";
import { chargeAiUsage } from "@/lib/ai/billing";
import { getPlanId } from "@/lib/subscription";
import { trackGrowthActivity } from "@/lib/gamification/engine";
import { slugify } from "@/utils/slug";

/** 무료 플랜은 카드뉴스를 제공하지 않는다(유료 전용 기능). 라우트가 403으로 응답한다. */
export class CardNewsPlanError extends Error {
  constructor(ko: boolean) {
    super(
      ko
        ? `카드뉴스는 유료 플랜(Basic 이상) 기능입니다. ${upsellSentence(true)}`
        : `Card news is available on paid plans (Basic and up). ${upsellSentence(false)}`,
    );
    this.name = "CardNewsPlanError";
  }
}

/**
 * 기존 블로그 글로 카드뉴스 생성+저장 공통 함수 — 과금(CARD_NEWS)→생성→
 * marketing_contents(instagram_cards) upsert→성장보상→실패 시 환불.
 * `/api/ai/card-news` 라우트와 AI 에이전트 도구가 공유한다.
 */
export async function generateAndSaveCardNews(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  businessId: string;
  blogPostId: string;
  locale?: PromptLanguage;
  /** 파트너 패킷(크레딧)으로 별도 과금하는 경우 기존 UP/쿼터 과금을 건너뛴다. */
  skipBilling?: boolean;
  /** 사용자가 넣은 스토리(선택) — 기승전결 구성의 중심. 없으면 글에서 뽑는다. */
  story?: string;
}): Promise<{ cardNewsId: string | null; cardNews: CardNewsResult }> {
  const { supabase, userId, businessId, blogPostId } = args;

  // 무료 플랜 차단 — 카드뉴스는 유료 전용. (파트너 패킷 과금 경로는 파트너 플랜이라 건너뛴다.)
  if (!args.skipBilling && (await getPlanId(userId)) === "free") {
    throw new CardNewsPlanError((args.locale ?? "ko") === "ko");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("name,tone,slug")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) throw new Error("business not found");

  const { data: post } = await supabase
    .from("blog_posts")
    .select("title,summary,content")
    .eq("id", blogPostId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!post) throw new Error("blog post not found");

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("tone")
    .eq("business_id", businessId)
    .maybeSingle();

  const billing = args.skipBilling
    ? { charged: 0, refund: async () => {} }
    : await chargeAiUsage(userId, "CARD_NEWS", "카드뉴스 생성");
  try {
    const result = await getAIProvider().generateCardNews({
      businessName: business.name,
      brandTone: brand?.tone ?? business.tone ?? "Friendly",
      handle: `@${slugify(business.slug) || "storyup"}`,
      articleTitle: post.title,
      articleSummary: post.summary ?? "",
      articleContent: post.content ?? "",
      language: args.locale ?? "ko",
      story: args.story,
    });

    // 기승전결 단계 보정 — 모델이 stage 를 빠뜨리면 순서대로 채운다.
    const STAGES = ["ki", "seung", "jeon", "gyeol"] as const;
    result.slides.forEach((s, i) => {
      if (!s.stage && i < STAGES.length) s.stage = STAGES[i];
    });
    if (args.story?.trim()) result.story = args.story.trim();

    // 마지막(CTA) 카드 로고 — 사이트 헤더 로고(websites.content.hero.logo)를 기본으로 넣는다.
    const { data: site } = await supabase
      .from("websites")
      .select("content")
      .eq("business_id", businessId)
      .maybeSingle();
    const logo =
      (site?.content as { hero?: { logo?: string | null } } | null)?.hero?.logo ??
      null;
    result.logoUrl = logo;
    result.showLogo = true;

    await supabase
      .from("marketing_contents")
      .delete()
      .eq("business_id", businessId)
      .eq("blog_post_id", blogPostId)
      .eq("platform", "instagram_cards");

    const { data: inserted } = await supabase
      .from("marketing_contents")
      .insert({
        business_id: businessId,
        blog_post_id: blogPostId,
        platform: "instagram_cards",
        content: JSON.stringify(result),
      })
      .select("id")
      .single();

    await trackGrowthActivity(userId, "card_created", blogPostId);
    return { cardNewsId: inserted?.id ?? null, cardNews: result };
  } catch (err) {
    await billing.refund();
    throw err;
  }
}
