import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  BusinessRow,
  BrandProfileRow,
  WebsiteRow,
  BlogPostRow,
} from "@/types/database";

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
