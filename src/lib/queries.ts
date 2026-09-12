import { cache } from "react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type {
  BusinessRow,
  BrandProfileRow,
  WebsiteRow,
  BlogPostRow,
  SiteInquiryRow,
} from "@/types/database";
import type { CardNewsResult, WebsiteContent } from "@/types/domain";

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
  /** 공개 사이트 주소용 슬러그 (웹사이트가 없으면 null) */
  websiteSlug: string | null;
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
            .select("business_id,status,slug")
            .in("business_id", ids),
          supabase
            .from("blog_posts")
            .select("business_id,status")
            .in("business_id", ids),
        ])
      : [{ data: [] }, { data: [] }];

  const webByBiz = new Map<string, { status: string; slug: string }>();
  (websites ?? []).forEach((w) =>
    webByBiz.set(w.business_id, { status: w.status, slug: w.slug }),
  );

  const enriched: DashboardBusiness[] = list.map((b) => {
    const bposts = (posts ?? []).filter((p) => p.business_id === b.id);
    const web = webByBiz.get(b.id);
    return {
      ...b,
      websiteStatus: (web?.status as "draft" | "published") ?? "none",
      websiteSlug: web?.slug ?? null,
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

/** 사이드바 워크스페이스용 대표 비즈니스 — 성장 패널의 primaryBusinessId와
 * 동일하게 가장 먼저 만든 비즈니스를 쓴다. businesses_public_read(0001_init.sql)로
 * published 사이트가 있는 남의 비즈니스도 읽히므로, RLS만으로는 부족하고
 * user_id로 명시 필터해 본인 것만 대표로 뽑는다. */
export async function getPrimaryBusiness(): Promise<{
  id: string;
  name: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Owned business by id. businesses_public_read (0001_init.sql) lets anyone
 *  read a business that has a published site, so RLS alone is not enough to
 *  scope this to the owner — filter by user_id explicitly so the owner-only
 *  dashboard shell notFound()s on someone else's business. */
export async function getBusiness(id: string): Promise<BusinessRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  return data ?? null;
}

/** 문의 1건 + 어느 랜딩페이지(비즈니스)로 왔는지 이름. */
export type UserInquiry = SiteInquiryRow & { businessName: string };

/** 로그인 사용자가 받은 모든 문의 (전 비즈니스, 최신순). RLS로 본인 것만 조회된다. */
export async function getUserInquiries(): Promise<UserInquiry[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: bizList } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", user.id);
  const nameMap = new Map((bizList ?? []).map((b) => [b.id, b.name]));

  const { data, error } = await supabase
    .from("site_inquiries")
    .select("*")
    .order("created_at", { ascending: false });
  // 0019 마이그레이션 이전 DB에서는 테이블이 없어 오류 → 빈 목록.
  if (error) return [];
  return (data ?? []).map((i) => ({
    ...i,
    businessName: nameMap.get(i.business_id) ?? "",
  }));
}

export interface SiteLogoItem {
  businessId: string;
  name: string;
  /** 직접 업로드한 로고 (없으면 null → 헤더에서 hero 사진으로 대체). */
  logo: string | null;
  /** 로고 미설정 시 대체로 쓰이는 hero 사진. */
  heroImage: string | null;
}

/** 설정 페이지 로고 관리용 — 사이트가 있는 사업체별 현재 로고·hero 사진. */
export async function getUserSiteLogos(): Promise<SiteLogoItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: bizList } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (!bizList?.length) return [];

  const { data: sites } = await supabase
    .from("websites")
    .select("business_id, content")
    .in(
      "business_id",
      bizList.map((b) => b.id),
    );
  const siteMap = new Map(
    (sites ?? []).map((s) => [s.business_id, s.content as WebsiteContent]),
  );
  // 로고는 사이트 헤더용이므로 사이트가 있는 사업체만 노출한다.
  return bizList
    .filter((b) => siteMap.has(b.id))
    .map((b) => {
      const c = siteMap.get(b.id)!;
      return {
        businessId: b.id,
        name: b.name,
        logo: c.hero?.logo ?? null,
        heroImage: c.hero?.image ?? null,
      };
    });
}

/** 대시보드 메뉴 배지용 — 로그인 사용자의 안 읽은 문의 총개수. */
export async function getUnreadInquiryCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("site_inquiries")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
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

/**
 * 주어진 사용자들의 공개(게시) 랜딩페이지 슬러그 맵 (user_id → slug).
 * 게시된 사이트 슬러그는 이미 공개 정보이므로, 남의 비즈니스도 조회할 수 있도록
 * 관리자 클라이언트로 읽는다. 블로그 댓글 작성자 이름을 그 사장님 랜딩페이지로 링크할 때 쓴다.
 */
export async function getAuthorSiteSlugs(
  userIds: (string | null)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((v): v is string => !!v))];
  const map = new Map<string, string>();
  if (ids.length === 0 || !supabaseConfigured()) return map;
  const admin = createAdminClient();

  const { data: bizList } = await admin
    .from("businesses")
    .select("id, user_id")
    .in("user_id", ids);
  if (!bizList?.length) return map;
  const bizOwner = new Map(bizList.map((b) => [b.id, b.user_id]));

  const { data: sites } = await admin
    .from("websites")
    .select("business_id, slug")
    .in(
      "business_id",
      bizList.map((b) => b.id),
    )
    .eq("status", "published");
  for (const s of sites ?? []) {
    const owner = bizOwner.get(s.business_id);
    // 사장님당 첫 게시 사이트만 (여러 개면 하나로 충분).
    if (owner && s.slug && !map.has(owner)) map.set(owner, s.slug);
  }
  return map;
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

/**
 * 여러 글의 댓글·좋아요 수를 한 번에 집계한다 (블로그 리스트 카드용).
 * 0014/0018 마이그레이션 이전 DB에서는 해당 테이블이 없어 0으로 동작한다.
 */
export async function getBlogEngagement(
  postIds: string[],
): Promise<Map<string, { comments: number; likes: number }>> {
  const map = new Map<string, { comments: number; likes: number }>();
  if (!supabaseConfigured() || postIds.length === 0) return map;
  for (const id of postIds) map.set(id, { comments: 0, likes: 0 });
  const supabase = await createClient();
  const [commentsRes, likesRes] = await Promise.all([
    supabase.from("blog_comments").select("post_id").in("post_id", postIds),
    supabase.from("blog_likes").select("post_id").in("post_id", postIds),
  ]);
  for (const r of commentsRes.data ?? []) {
    const e = map.get(r.post_id);
    if (e) e.comments += 1;
  }
  for (const r of likesRes.data ?? []) {
    const e = map.get(r.post_id);
    if (e) e.likes += 1;
  }
  return map;
}

/** 단일 글의 좋아요 수 + 현재 방문자의 좋아요 여부 (글 상세용). */
export async function getPostLikeState(
  postId: string,
): Promise<{ count: number; likedByMe: boolean }> {
  if (!supabaseConfigured()) return { count: 0, likedByMe: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 익명 방문자 키는 좋아요 액션에서 심는 bl_vid 쿠키를 따른다.
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const vid = store.get("bl_vid")?.value;
  const visitorKey = user ? `user:${user.id}` : `anon:${vid ?? ""}`;

  const { count, error } = await supabase
    .from("blog_likes")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (error) return { count: 0, likedByMe: false };

  // 방문자 키를 특정할 수 없으면(익명·쿠키 없음) 좋아요 여부는 false.
  let likedByMe = false;
  if (user || vid) {
    const { data: mine } = await supabase
      .from("blog_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("visitor_key", visitorKey)
      .maybeSingle();
    likedByMe = !!mine;
  }
  return { count: count ?? 0, likedByMe };
}

// ---------------- Showcase (landing portfolio) ----------------

/** All published websites, newest first. RLS allows anon read. */
/** 쇼케이스 사이트 — 업종(대분류) 필터를 위해 사업체 industry를 함께 싣는다. */
export type ShowcaseSite = WebsiteRow & { industry: string | null };

export async function getShowcaseSites(limit = 12): Promise<ShowcaseSite[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("websites")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  const sites = data ?? [];
  if (!sites.length) return [];
  const { data: bizs } = await supabase
    .from("businesses")
    .select("id, industry")
    .in(
      "id",
      sites.map((s) => s.business_id),
    );
  const ind = new Map((bizs ?? []).map((b) => [b.id, b.industry]));
  return sites.map((s) => ({ ...s, industry: ind.get(s.business_id) ?? null }));
}

export interface ShowcasePost {
  post: BlogPostRow;
  /** 글이 속한 공개 사이트의 슬러그 (링크용) */
  siteSlug: string;
  businessName: string;
  /** 사업체 업종(대분류) id — 업종별 필터용. 미설정이면 null */
  industry: string | null;
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

  const [{ data: posts }, { data: bizs }] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("*")
      .in("business_id", [...byBusiness.keys()])
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit),
    supabase
      .from("businesses")
      .select("id, industry")
      .in("id", [...byBusiness.keys()]),
  ]);
  const ind = new Map((bizs ?? []).map((b) => [b.id, b.industry]));

  return (posts ?? []).map((post) => {
    const site = byBusiness.get(post.business_id)!;
    return {
      post,
      siteSlug: site.slug,
      businessName: site.name,
      industry: ind.get(post.business_id) ?? null,
    };
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
  /** 사업체 업종(대분류) id — 업종별 필터용. 미설정이면 null */
  industry: string | null;
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

  const [{ data: rows }, { data: bizs }] = await Promise.all([
    supabase
      .from("marketing_contents")
      .select("id, business_id, blog_post_id, content, created_at")
      .in("business_id", [...byBusiness.keys()])
      .eq("platform", "instagram_cards")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("businesses")
      .select("id, industry")
      .in("id", [...byBusiness.keys()]),
  ]);
  const industryByBiz = new Map((bizs ?? []).map((b) => [b.id, b.industry]));

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
        industry: industryByBiz.get(row.business_id) ?? null,
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
          // 저장된 카드별 배경 — 슬라이더가 모든 카드에 표시한다
          images: Array.isArray(parsed.images) ? parsed.images : undefined,
        },
      });
    } catch {
      // 파싱 불가한 카드뉴스는 건너뛴다.
    }
  }
  return cards;
}
