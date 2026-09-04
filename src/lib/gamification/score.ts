import { createAdminClient } from "@/lib/supabase/server";
import { loadSettings } from "./config";
import { kstDate } from "./engine";
import type { WebsiteContent } from "@/types/domain";

/**
 * Story Score — 온라인 브랜드 성장도 0~100.
 * 각 영역 완성률(0~1) × 가중치(reward_settings.score_weights, 합 100)의 합.
 * 가중치·기준을 바꾸기 쉽도록 영역 계산을 함수로 분리했다.
 */

export interface ScorePart {
  key: "brand" | "website" | "blog" | "sns" | "share" | "seo";
  labelKo: string;
  labelEn: string;
  /** 완성률 0~100 */
  pct: number;
  weight: number;
}

export interface StoryScore {
  score: number;
  parts: ScorePart[];
  /** 직전 스냅샷 점수 (오늘 이전 가장 최근) — "72 → 78" 표시용 */
  previous: number | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function brandPct(profiles: Array<Record<string, unknown>>): number {
  if (profiles.length === 0) return 0;
  let best = 0;
  for (const p of profiles) {
    const fields = [
      p.brand_story,
      p.headline,
      p.short_description,
      p.mission,
      p.target_customer,
      Array.isArray(p.key_strengths) && p.key_strengths.length > 0,
      Array.isArray(p.brand_keywords) && p.brand_keywords.length > 0,
    ];
    const filled = fields.filter(Boolean).length;
    best = Math.max(best, (filled / fields.length) * 100);
  }
  return clamp(best);
}

function websitePct(
  sites: Array<{ status: string; content: WebsiteContent }>,
): number {
  if (sites.length === 0) return 0;
  let best = 0;
  for (const s of sites) {
    let pct = 40; // 사이트 존재
    if (s.status === "published") pct += 30;
    const c = s.content;
    if (c?.hero?.image) pct += 10;
    if (c?.hero?.logo) pct += 10;
    if ((c?.gallery?.length ?? 0) > 0) pct += 10;
    best = Math.max(best, pct);
  }
  return clamp(best);
}

function blogPct(
  publishedCount: number,
  lastPublishedAt: string | null,
): number {
  // 발행 수 최대 70 (10개 기준) + 최근성 최대 30
  let pct = Math.min(70, (publishedCount / 10) * 70);
  if (lastPublishedAt) {
    const days = (Date.now() - new Date(lastPublishedAt).getTime()) / 86_400_000;
    if (days <= 7) pct += 30;
    else if (days <= 30) pct += 15;
  }
  return clamp(pct);
}

export async function computeStoryScore(userId: string): Promise<StoryScore> {
  const settings = await loadSettings();
  const w = settings.scoreWeights;
  const admin = createAdminClient();

  const empty = (pcts: Partial<Record<ScorePart["key"], number>> = {}) =>
    buildScore(pcts, w, null);

  try {
    const { data: businesses } = await admin
      .from("businesses")
      .select("id")
      .eq("user_id", userId);
    const ids = (businesses ?? []).map((b) => b.id);
    if (ids.length === 0) return empty();

    const [brands, sites, blogs, sns, shares, prevSnap, search] = await Promise.all([
      admin
        .from("brand_profiles")
        .select(
          "brand_story, headline, short_description, mission, target_customer, key_strengths, brand_keywords",
        )
        .in("business_id", ids),
      admin.from("websites").select("status, content").in("business_id", ids),
      admin
        .from("blog_posts")
        .select("status, published_at, seo_title, seo_description, keywords")
        .in("business_id", ids),
      admin
        .from("marketing_contents")
        .select("id", { count: "exact", head: true })
        .in("business_id", ids),
      admin
        .from("activity_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("action", "share"),
      admin
        .from("story_score_history")
        .select("score")
        .eq("user_id", userId)
        .lt("date", kstDate())
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("search_stats")
        .select("impressions, clicks")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const posts = blogs.data ?? [];
    const published = posts.filter((p) => p.status === "published");
    const lastPublished = published
      .map((p) => p.published_at)
      .filter(Boolean)
      .sort()
      .at(-1) as string | null;

    // SEO: 메타데이터 완성률(최대 70) + 실제 검색 성과(GSC 캐시, 최대 30)
    const seoReady = published.filter(
      (p) => p.seo_title && p.seo_description && (p.keywords?.length ?? 0) > 0,
    ).length;
    const metaPct =
      published.length === 0 ? 0 : (seoReady / published.length) * 70;
    const searchBonus =
      ((search.data?.impressions ?? 0) > 0 ? 15 : 0) +
      ((search.data?.clicks ?? 0) > 0 ? 15 : 0);
    const seoPct = clamp(metaPct + searchBonus);

    const pcts: Record<ScorePart["key"], number> = {
      brand: brandPct((brands.data ?? []) as Array<Record<string, unknown>>),
      website: websitePct(
        (sites.data ?? []) as Array<{ status: string; content: WebsiteContent }>,
      ),
      blog: blogPct(published.length, lastPublished ?? null),
      sns: clamp(((sns.count ?? 0) / 10) * 100),
      share: clamp((((shares.count as number | null) ?? 0) / 10) * 100),
      seo: seoPct,
    };

    return buildScore(pcts, w, prevSnap.data?.score ?? null);
  } catch {
    return empty();
  }
}

function buildScore(
  pcts: Partial<Record<ScorePart["key"], number>>,
  w: Record<string, number>,
  previous: number | null,
): StoryScore {
  const defs: Array<[ScorePart["key"], string, string]> = [
    ["brand", "브랜드 프로필", "Brand profile"],
    ["website", "홈페이지", "Landing page"],
    ["blog", "블로그", "Blog"],
    ["sns", "SNS", "SNS"],
    ["share", "공유", "Sharing"],
    ["seo", "SEO", "SEO"],
  ];
  const parts: ScorePart[] = defs.map(([key, labelKo, labelEn]) => ({
    key,
    labelKo,
    labelEn,
    pct: pcts[key] ?? 0,
    weight: w[key] ?? 0,
  }));
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0) || 100;
  const score = Math.round(
    parts.reduce((s, p) => s + (p.pct / 100) * p.weight, 0) * (100 / totalWeight),
  );
  return { score, parts, previous };
}

/** 오늘 스냅샷 저장 (하루 1행, 최신값으로 갱신). */
export async function snapshotStoryScore(
  userId: string,
  score: StoryScore,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("story_score_history").upsert({
      user_id: userId,
      date: kstDate(),
      score: score.score,
      breakdown: Object.fromEntries(score.parts.map((p) => [p.key, p.pct])),
    });
  } catch {
    /* 무시 */
  }
}

// ---------- AI Next Action ----------

export interface NextAction {
  textKo: string;
  textEn: string;
  href: string;
  ctaKo: string;
  ctaEn: string;
}

/**
 * Story Score에서 가장 약한 영역을 골라 다음 행동을 추천한다.
 * businessId가 있으면 해당 대시보드 딥링크로 연결한다.
 */
export function nextActionFor(
  score: StoryScore,
  businessId: string | null,
): NextAction {
  const weakest = [...score.parts].sort(
    (a, b) => a.pct * a.weight - b.pct * b.weight,
  )[0];
  const base = businessId ? `/business/${businessId}` : "/onboarding";
  switch (weakest?.key) {
    case "brand":
      return {
        textKo: "브랜드 프로필이 아직 완성되지 않았어요. 브랜드 스토리를 채우면 모든 콘텐츠 품질이 올라갑니다.",
        textEn: "Your brand profile isn't complete yet. Filling it in improves every piece of content.",
        href: businessId ? `${base}/brand` : base,
        ctaKo: "브랜드 스토리 완성하기",
        ctaEn: "Complete brand story",
      };
    case "website":
      return {
        textKo: "홈페이지를 다듬으면 Story Score가 크게 올라요. 로고·사진·게시 상태를 확인해보세요.",
        textEn: "Polishing your landing page will boost your Story Score. Check the logo, photos, and publish status.",
        href: businessId ? `${base}/website` : base,
        ctaKo: "홈페이지 다듬기",
        ctaEn: "Improve landing page",
      };
    case "sns":
      return {
        textKo: "SNS 카드뉴스를 만들어 새 고객에게 닿아보세요.",
        textEn: "Create SNS card news to reach new customers.",
        href: businessId ? `${base}/marketing` : base,
        ctaKo: "SNS 카드뉴스 만들기",
        ctaEn: "Create card news",
      };
    case "share":
      return {
        textKo: "만든 콘텐츠를 SNS에 공유하면 방문자가 늘어납니다.",
        textEn: "Sharing your content on social media brings more visitors.",
        href: businessId ? `${base}/marketing` : base,
        ctaKo: "콘텐츠 공유하기",
        ctaEn: "Share content",
      };
    case "seo":
      return {
        textKo: "블로그 글의 SEO 제목·설명을 채우면 검색 노출이 좋아집니다.",
        textEn: "Filling in SEO titles and descriptions improves search visibility.",
        href: businessId ? `${base}/blog` : base,
        ctaKo: "SEO 다듬기",
        ctaEn: "Tune SEO",
      };
    case "blog":
    default:
      return {
        textKo: "이번 주 블로그를 1~2개 더 발행하면 Story Score를 높일 수 있어요.",
        textEn: "Publishing 1–2 more blog posts this week will raise your Story Score.",
        href: businessId ? `${base}/blog` : base,
        ctaKo: "AI로 블로그 작성하기",
        ctaEn: "Write a blog with AI",
      };
  }
}
