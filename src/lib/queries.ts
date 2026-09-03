import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  BusinessRow,
  BrandProfileRow,
  WebsiteRow,
  BlogPostRow,
} from "@/types/database";
import type { CardNewsResult } from "@/types/domain";

/** Current authenticated user, or null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfileName(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "게스트";
  const { data } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    data?.name ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "회원"
  );
}

export interface DashboardBusiness extends BusinessRow {
  websiteStatus: "none" | "draft" | "published";
  blogCount: number;
  publishedBlogCount: number;
}

export interface DashboardData {
  businesses: DashboardBusiness[];
  totals: {
    businesses: number;
    websites: number;
    blogPosts: number;
    published: number;
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const list = businesses ?? [];
  const ids = list.map((b) => b.id);

  const [{ data: websites }, { data: posts }] =
    ids.length > 0
      ? await Promise.all([
          supabase
            .from("websites")
            .select("business_id,status")
            .in("business_id", ids),
          supabase
            .from("blog_posts")
            .select("business_id,status")
            .in("business_id", ids),
        ])
      : [{ data: [] }, { data: [] }];

  const webByBiz = new Map<string, string>();
  (websites ?? []).forEach((w) => webByBiz.set(w.business_id, w.status));

  const enriched: DashboardBusiness[] = list.map((b) => {
    const bposts = (posts ?? []).filter((p) => p.business_id === b.id);
    return {
      ...b,
      websiteStatus: (webByBiz.get(b.id) as "draft" | "published") ?? "none",
      blogCount: bposts.length,
      publishedBlogCount: bposts.filter((p) => p.status === "published").length,
    };
  });

  return {
    businesses: enriched,
    totals: {
      businesses: list.length,
      websites: (websites ?? []).length,
      blogPosts: (posts ?? []).length,
      published:
        (websites ?? []).filter((w) => w.status === "published").length +
        (posts ?? []).filter((p) => p.status === "published").length,
    },
  };
}

/** Owned business by id (RLS enforces ownership). */
export async function getBusiness(id: string): Promise<BusinessRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export async function getBrandProfile(
  businessId: string,
): Promise<BrandProfileRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  return data ?? null;
}

export async function getWebsite(
  businessId: string,
): Promise<WebsiteRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("websites")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  return data ?? null;
}

export async function getBlogPosts(
  businessId: string,
): Promise<BlogPostRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function getBlogPost(id: string): Promise<BlogPostRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

// ---------------- Workflow (STEP 진행 상태) ----------------

export interface WorkflowState {
  /** STEP 1 — 브랜드 스토리 생성 여부 */
  brand: boolean;
  /** STEP 2 — 랜딩페이지 상태 */
  website: "none" | "draft" | "published";
  /** STEP 3 — 블로그 글 수 */
  blogTotal: number;
  blogPublished: number;
  /** STEP 4 — SNS 콘텐츠(게시물·카드뉴스) 생성 여부 */
  sns: boolean;
}

/** 한 비즈니스의 STEP 1~4 진행 상태. cache(): 한 요청 안에서 한 번만 조회. */
export const getWorkflowState = cache(async function getWorkflowState(
  businessId: string,
): Promise<WorkflowState> {
  const supabase = await createClient();
  const [brandRes, webRes, postRes, snsRes] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select("id")
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("websites")
      .select("status")
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase.from("blog_posts").select("status").eq("business_id", businessId),
    supabase
      .from("marketing_contents")
      .select("id")
      .eq("business_id", businessId)
      .limit(1),
  ]);

  const posts = postRes.data ?? [];
  return {
    brand: !!brandRes.data,
    website: (webRes.data?.status as "draft" | "published") ?? "none",
    blogTotal: posts.length,
    blogPublished: posts.filter((p) => p.status === "published").length,
    sns: (snsRes.data ?? []).length > 0,
  };
});

// ---------------- Public (unauthenticated) reads ----------------

const supabaseConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface PublishedSite {
  business: BusinessRow;
  website: WebsiteRow;
}

/** A published website + its business, by public slug. RLS allows anon read.
 *  cache(): layout + page both call this within one request — one query. */
export const getPublishedSite = cache(async function getPublishedSite(
  slug: string,
): Promise<PublishedSite | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: website } = await supabase
    .from("websites")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!website) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", website.business_id)
    .maybeSingle();
  if (!business) return null;

  return { business, website };
});

export async function getPublishedPosts(
  businessId: string,
): Promise<BlogPostRow[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return data ?? [];
}

/** 비즈니스의 블로그 메뉴(카테고리) 목록 — 글에 쓰인 값들의 중복 제거본. */
export async function getBlogCategories(businessId: string): Promise<string[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("category")
    .eq("business_id", businessId)
    .not("category", "is", null);
  // category 컬럼 마이그레이션(0013) 이전 DB에서는 빈 목록으로 동작한다.
  if (error || !data) return [];
  return [...new Set(data.map((r) => r.category as string).filter(Boolean))];
}

export async function getPublishedPost(
  businessId: string,
  postSlug: string,
): Promise<BlogPostRow | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("business_id", businessId)
    .eq("slug", postSlug)
    .eq("status", "published")
    .maybeSingle();
  return data ?? null;
}

// ---------------- Showcase (landing portfolio) ----------------

/** All published websites, newest first. RLS allows anon read. */
export async function getShowcaseSites(limit = 12): Promise<WebsiteRow[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("websites")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export interface ShowcasePost {
  post: BlogPostRow;
  /** 글이 속한 공개 사이트의 슬러그 (링크용) */
  siteSlug: string;
  businessName: string;
}

/** Published posts whose site is also published, newest first. */
export async function getShowcasePosts(limit = 12): Promise<ShowcasePost[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("websites")
    .select("business_id, slug, content")
    .eq("status", "published");
  if (!sites?.length) return [];

  const byBusiness = new Map(
    sites.map((s) => [
      s.business_id,
      {
        slug: s.slug,
        name:
          (s.content as { hero?: { businessName?: string } }).hero
            ?.businessName ?? "",
      },
    ]),
  );

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("*")
    .in("business_id", [...byBusiness.keys()])
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  return (posts ?? []).map((post) => {
    const site = byBusiness.get(post.business_id)!;
    return { post, siteSlug: site.slug, businessName: site.name };
  });
}

export interface ShowcaseCard {
  id: string;
  title: string;
  subtitle: string;
  siteSlug: string;
  businessName: string;
  /** 블로그 커버 → 사이트 히어로 → 갤러리 순으로 자동 채운 대표 이미지 */
  image: string | null;
  /** 카드뉴스 전체 내용 — 쇼케이스에서 슬라이드로 보여준다. */
  cardNews: CardNewsResult;
}

/** Card-news sets from businesses with a published site, newest first. */
export async function getShowcaseCards(limit = 12): Promise<ShowcaseCard[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("websites")
    .select("business_id, slug, content")
    .eq("status", "published");
  if (!sites?.length) return [];

  const byBusiness = new Map(
    sites.map((s) => {
      const content = s.content as {
        hero?: { businessName?: string; image?: string };
        gallery?: string[];
      };
      return [
        s.business_id,
        {
          slug: s.slug,
          name: content.hero?.businessName ?? "",
          image: content.hero?.image ?? content.gallery?.[0] ?? null,
        },
      ] as const;
    }),
  );

  const { data: rows } = await supabase
    .from("marketing_contents")
    .select("id, business_id, blog_post_id, content, created_at")
    .in("business_id", [...byBusiness.keys()])
    .eq("platform", "instagram_cards")
    .order("created_at", { ascending: false })
    .limit(limit);

  // 카드뉴스가 만들어진 블로그 글의 커버 이미지를 대표 이미지로 우선 사용한다.
  const postIds = [...new Set((rows ?? []).map((r) => r.blog_post_id).filter(Boolean))] as string[];
  const coverByPost = new Map<string, string>();
  if (postIds.length > 0) {
    const { data: posts } = await supabase
      .from("blog_posts")
      .select("id, cover_image_url")
      .in("id", postIds);
    for (const p of posts ?? [])
      if (p.cover_image_url) coverByPost.set(p.id, p.cover_image_url);
  }

  const cards: ShowcaseCard[] = [];
  for (const row of rows ?? []) {
    try {
      const parsed = JSON.parse(row.content) as CardNewsResult;
      if (!parsed.cover?.title) continue;
      const site = byBusiness.get(row.business_id)!;
      cards.push({
        id: row.id,
        title: parsed.cover.title,
        subtitle: parsed.cover.subtitle ?? "",
        siteSlug: site.slug,
        businessName: site.name,
        image:
          (row.blog_post_id && coverByPost.get(row.blog_post_id)) ||
          site.image,
        cardNews: {
          cover: {
            title: parsed.cover.title,
            subtitle: parsed.cover.subtitle ?? "",
          },
          slides: Array.isArray(parsed.slides) ? parsed.slides : [],
          cta: parsed.cta ?? { text: "", handle: `@${site.slug}` },
        },
      });
    } catch {
      // 파싱 불가한 카드뉴스는 건너뛴다.
    }
  }
  return cards;
}
