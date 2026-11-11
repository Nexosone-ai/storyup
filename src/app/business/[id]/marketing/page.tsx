import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBusiness, getBlogPosts, getWebsite } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { getShortsQuota, getUserPlan } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { getYoutubeStatus } from "@/lib/youtube";
import { getVideoPricing, videoEngineConfigured } from "@/lib/video";
import { listDeliverables } from "@/lib/agency";
import { getLocale } from "@/lib/i18n";
import { CHANNEL_ADS_ENABLED } from "@/lib/channelAds/config";
import { WorkflowSteps } from "@/components/dashboard/WorkflowSteps";
import { GuidedTour } from "@/components/ui/GuidedTour";
import {
  ContentStudio,
  type StudioVideoData,
} from "@/components/studio/ContentStudio";
import type { CardNewsResult, WebsiteContent } from "@/types/domain";

export const metadata = { title: "콘텐츠 스튜디오" };

/**
 * 콘텐츠 스튜디오 — 글 선택 → 카드뉴스 → 쇼츠 만들기 → 쇼츠 편집 → 공유 → AI 동영상을
 * 한 페이지에서 단계적으로. (구 'SNS' 페이지를 개편; /video 는 6단계로 리다이렉트)
 */
export default async function MarketingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();
  const ko = (await getLocale()) === "ko";

  const [posts, website] = await Promise.all([getBlogPosts(id), getWebsite(id)]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [shortsQuota, ytStatus, plan] = user
    ? await Promise.all([
        getShortsQuota(user.id),
        getYoutubeStatus(user.id),
        getUserPlan(user.id),
      ])
    : [null, null, getPlanById("free")];
  const planId = plan.id;
  const proPlan = planId === "pro" || planId === "partner";
  // 카드뉴스·쇼츠는 유료 전용 — 무료 플랜은 업그레이드 안내만.
  const isFreePlan = planId === "free";
  const shortsYoutube = ytStatus
    ? {
        configured: ytStatus.configured,
        connected: ytStatus.connected,
        channelTitle: ytStatus.channelTitle,
        canUse: proPlan,
      }
    : null;

  // 최신 SNS 캡션(인스타/페북) + 최신 카드뉴스 세트.
  const [{ data: textRows }, { data: cardRow }] = await Promise.all([
    supabase
      .from("marketing_contents")
      .select("blog_post_id,platform,content,created_at")
      .eq("business_id", id)
      .in("platform", ["instagram", "facebook"])
      .order("created_at", { ascending: false })
      .limit(2),
    supabase
      .from("marketing_contents")
      .select("id,blog_post_id,content,thanks_count,view_count")
      .eq("business_id", id)
      .eq("platform", "instagram_cards")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const initialText: { instagram?: string; facebook?: string; blogPostId?: string } = {};
  (textRows ?? []).forEach((row) => {
    if (row.platform === "instagram") initialText.instagram = row.content;
    if (row.platform === "facebook") initialText.facebook = row.content;
    initialText.blogPostId = row.blog_post_id ?? undefined;
  });

  let initialCards:
    | { cardNews?: CardNewsResult; blogPostId?: string; id?: string; thanks?: number; views?: number }
    | undefined;
  if (cardRow?.content) {
    try {
      initialCards = {
        cardNews: JSON.parse(cardRow.content) as CardNewsResult,
        blogPostId: cardRow.blog_post_id ?? undefined,
        id: cardRow.id,
        thanks: cardRow.thanks_count,
        views: cardRow.view_count,
      };
    } catch {
      initialCards = undefined;
    }
  }

  // AI 동영상(6단계) — 플랜이 제공할 때만 조회(무료는 업그레이드 안내, 쿼리 생략).
  let video: StudioVideoData | null = null;
  if (user && plan.limits.video !== 0) {
    const [pricing, deliverables, pendingRes] = await Promise.all([
      getVideoPricing(user.id),
      listDeliverables(id),
      supabase
        .from("video_jobs")
        .select("id, prompt, created_at")
        .eq("business_id", id)
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    video = {
      pricing: { price: pricing.price, balance: pricing.balance },
      engineReady: videoEngineConfigured(),
      videos: deliverables.filter((d) => d.kind === "video"),
      pendingJobs: (pendingRes.data ?? []).map((j) => ({
        id: j.id,
        prompt: j.prompt,
        createdAt: j.created_at,
      })),
    };
  }

  const postOptions = posts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    published: p.status === "published",
    socialCaption: p.social_caption,
  }));
  const siteSlug = website?.status === "published" ? website.slug : null;
  // 카드뉴스 마지막 카드 기본 로고 — 사이트 헤더 로고(hero.logo).
  const logoUrl =
    (website?.content as unknown as WebsiteContent | null | undefined)?.hero
      ?.logo ?? null;

  // 초기 단계·글 — 서버에서 계산해 SSR/클라이언트가 일치하게.
  const published = postOptions.filter((p) => p.published);
  const initialPostId =
    (initialCards?.blogPostId && published.some((p) => p.id === initialCards?.blogPostId)
      ? initialCards.blogPostId
      : published[0]?.id) ?? "";
  const initialStep = !initialPostId
    ? 1
    : !initialCards
      ? 2
      : (shortsQuota?.used ?? 0) > 0
        ? 5
        : 3;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-2">{ko ? "콘텐츠" : "Content"}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "콘텐츠 스튜디오" : "Content studio"}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "블로그 글 하나로 카드뉴스 → 쇼츠 → 편집 → 공유 → AI 동영상까지, 한 곳에서 단계대로."
            : "From one blog post: cards → short → edit → share → AI video, step by step in one place."}
        </p>
      </div>

      <WorkflowSteps businessId={id} current={4} />

      <GuidedTour
        storageKey="tour.studio.v1"
        autoStart={!initialCards && !initialText.instagram && !initialText.facebook}
        steps={[
          {
            target: "[data-tour=studio-steps]",
            title: ko ? "① 6단계로 끝내요" : "① Six steps, one place",
            desc: ko
              ? "글 선택 → 카드뉴스 → 쇼츠 → 편집 → 공유 → AI 동영상 순서예요. 완료된 단계는 체크로 표시되고, 번호를 눌러 오갈 수 있어요."
              : "Pick a post → cards → short → edit → share → AI video. Done steps get a check; click a number to jump.",
          },
          {
            target: "[data-tour=studio-post]",
            title: ko ? "② 발행된 글을 고르세요" : "② Pick a published post",
            desc: ko
              ? "이 글 하나로 카드뉴스와 쇼츠를 만듭니다. 글이 없으면 '새 글 쓰기'로 먼저 발행하세요."
              : "Everything is built from this one post. No posts yet? Write and publish one first.",
          },
          {
            target: "[data-tour=studio-next]",
            title: ko ? "③ 다음 단계로" : "③ Move on",
            desc: ko
              ? "각 단계 아래 '다음 단계' 안내를 따라가면 돼요."
              : "Follow the 'Next step' hint under each step.",
          },
        ]}
      />

      <Suspense fallback={null}>
        <ContentStudio
          businessId={id}
          ko={ko}
          posts={postOptions}
          brandName={business.name}
          handle={`@${business.slug}`}
          siteSlug={siteSlug}
          logoUrl={logoUrl}
          initialCards={initialCards}
          initialText={initialText}
          shortsQuota={shortsQuota}
          shortsYoutube={shortsYoutube}
          isFreePlan={isFreePlan}
          video={video}
          channelAdsEnabled={CHANNEL_ADS_ENABLED}
          initialStep={initialStep}
          initialPostId={initialPostId}
        />
      </Suspense>
    </div>
  );
}
