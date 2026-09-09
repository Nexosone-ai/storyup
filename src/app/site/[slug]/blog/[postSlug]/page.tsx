import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getPublishedSite,
  getPublishedPost,
  getPublishedPosts,
} from "@/lib/queries";
import { pickRelatedPosts } from "@/utils/relatedPosts";
import { createClient } from "@/lib/supabase/server";
import { siteLang, SiteLogo } from "@/components/website/templates/shared";
import { renderMarkdown } from "@/utils/markdown";
import { BlogCover } from "@/components/blog/BlogCover";
import { ShareBar } from "@/components/site/ShareBar";
import { BlogComments } from "@/components/site/BlogComments";
import { TrackPageView } from "@/components/site/TrackPageView";
import { buildSeo, siteUrl } from "@/utils/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) return { title: "글을 찾을 수 없습니다" };
  const post = await getPublishedPost(site.business.id, postSlug);
  if (!post) return { title: "글을 찾을 수 없습니다" };

  return buildSeo({
    title: post.seo_title || post.title,
    description: post.seo_description || post.summary,
    keywords: post.keywords,
    path: `/site/${slug}/blog/${postSlug}`,
    image: post.cover_image_url ?? undefined,
    type: "article",
    publishedTime: post.published_at ?? undefined,
    modifiedTime: post.updated_at,
  });
}

function fmtDate(iso: string | null, ko: boolean): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const { slug, postSlug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) notFound();
  const post = await getPublishedPost(site.business.id, postSlug);
  if (!post) notFound();

  const html = await renderMarkdown(post.content ?? "");
  const name = site.website.content.hero?.businessName ?? site.business.name;
  const path = `/site/${slug}/blog/${postSlug}`;
  // 사이트 콘텐츠 언어에 맞춰 크롬 문구를 고른다
  const ko = siteLang(site.website.content) === "ko";

  // 관련 콘텐츠 — 키워드/카테고리 기반 내부 링크 (SEO 토픽 클러스터의 기초)
  const allPosts = await getPublishedPosts(site.business.id);
  const relatedPosts = pickRelatedPosts(post, allPosts);

  // 방문자 댓글 — 마이그레이션(0014) 이전 DB에서는 섹션을 숨긴다.
  const supabase = await createClient();
  const [{ data: rawComments, error: commentsError }, userRes] =
    await Promise.all([
      supabase
        .from("blog_comments")
        .select("id, user_id, author_name, password_hash, content, created_at")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true }),
      supabase.auth.getUser(),
    ]);
  const viewer = userRes.data.user;
  const isOwner = !!viewer && viewer.id === site.business.user_id;
  const comments = commentsError
    ? null
    : (rawComments ?? []).map((c) => ({
        id: c.id,
        authorName: c.author_name,
        content: c.content,
        createdAt: c.created_at,
        canDelete: isOwner || (!!viewer && c.user_id === viewer.id),
        hasPassword: !!c.password_hash,
      }));

  // 검색·AI 답변엔진(AEO)용 구조화 데이터 — Google 리치 결과 권장 필드 포함
  const siteHome = `${siteUrl}/site/${slug}`;
  const blogHome = `${siteUrl}/site/${slug}/blog`;
  const logo = site.website.content.hero?.logo;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seo_description || post.summary || undefined,
    keywords: post.keywords.join(", ") || undefined,
    image: post.cover_image_url || undefined,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at,
    inLanguage: ko ? "ko" : "en",
    url: `${siteUrl}${path}`,
    mainEntityOfPage: `${siteUrl}${path}`,
    author: { "@type": "Organization", name, url: siteHome },
    publisher: {
      "@type": "Organization",
      name,
      url: siteHome,
      ...(logo?.startsWith("http")
        ? { logo: { "@type": "ImageObject", url: logo } }
        : {}),
    },
  };

  // 사이트 계층(STORYUP → 브랜드 → 블로그 → 글) — Google 브레드크럼 리치 결과용
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "STORYUP", item: siteUrl },
      { "@type": "ListItem", position: 2, name, item: siteHome },
      {
        "@type": "ListItem",
        position: 3,
        name: ko ? "블로그" : "Blog",
        item: blogHome,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: post.title,
        item: `${siteUrl}${path}`,
      },
    ],
  };

  return (
    <div className="min-h-dvh bg-white">
      <TrackPageView slug={slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
          <Link
            href={`/site/${slug}`}
            className="flex min-w-0 items-center gap-2 font-bold tracking-tight"
          >
            <SiteLogo
              src={site.website.content.hero?.logo}
              className="h-7 max-w-28"
            />
            <span className="truncate">{name}</span>
          </Link>
          <Link href={`/site/${slug}/blog`} className="text-sm text-muted">
            {ko ? "← 블로그" : "← Blog"}
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-5 py-12">
        {/* 브레드크럼 — 위 BreadcrumbList 스키마와 짝을 이루는 실제 내부 링크 */}
        <nav
          aria-label={ko ? "탐색 경로" : "Breadcrumb"}
          className="flex flex-wrap items-center gap-1.5 text-xs text-muted"
        >
          <Link href={`/site/${slug}`} className="hover:text-foreground">
            {name}
          </Link>
          <span aria-hidden>›</span>
          <Link href={`/site/${slug}/blog`} className="hover:text-foreground">
            {ko ? "블로그" : "Blog"}
          </Link>
        </nav>
        <p className="mt-3 text-sm text-muted">
          {post.published_at && (
            <time dateTime={post.published_at}>
              {fmtDate(post.published_at, ko)}
            </time>
          )}
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        {post.summary && (
          <p className="mt-4 text-lg text-muted">{post.summary}</p>
        )}
        <ShareBar path={path} title={post.title} slug={slug} className="mt-5" />
        {post.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- 원격 스토리지 URL, 크기 고정 컨테이너
          <img
            src={post.cover_image_url}
            alt={post.title}
            fetchPriority="high"
            className="mt-8 aspect-[16/7] w-full rounded-2xl object-cover"
          />
        ) : (
          <BlogCover
            title={post.title}
            seed={post.slug}
            label={post.keywords[0] ? `#${post.keywords[0]}` : undefined}
            showTitle={false}
            className="mt-8 aspect-[16/7] w-full rounded-2xl"
          />
        )}
        <div
          className="prose mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {post.keywords.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6">
            {post.keywords.map((k) => (
              <span
                key={k}
                className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted"
              >
                #{k}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 border-t border-border pt-6">
          <p className="mb-3 text-sm font-medium text-muted">
            {ko
              ? "이 글이 도움이 되었다면 공유해주세요"
              : "Found this helpful? Share it"}
          </p>
          <ShareBar path={path} title={post.title} slug={slug} />
        </div>

        {relatedPosts.length > 0 && (
          <nav
            aria-label={ko ? "관련 콘텐츠" : "Related posts"}
            className="mt-10 border-t border-border pt-6"
          >
            <p className="mb-3 text-sm font-semibold">
              {ko ? "관련 콘텐츠" : "Related posts"}
            </p>
            <ul className="space-y-2">
              {relatedPosts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/site/${slug}/blog/${p.slug}`}
                    className="group flex items-baseline gap-2 text-sm"
                  >
                    <span className="font-medium underline-offset-2 group-hover:underline">
                      {p.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {fmtDate(p.published_at, ko)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* 브랜드 사이트로 되돌아가는 내부 링크 — 검색엔진의 사이트 구조 탐색을 돕는다 */}
        <div className="mt-10 border-t border-border pt-6">
          <Link
            href={`/site/${slug}`}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-border p-5 transition hover:border-primary/40"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold group-hover:text-primary">
                {ko ? `${name} 더 알아보기` : `More about ${name}`}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted">
                {ko
                  ? "브랜드 소개와 다른 이야기를 만나보세요"
                  : "Discover the brand and its other stories"}
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-muted group-hover:text-primary">
              →
            </span>
          </Link>
        </div>

        {comments && (
          <BlogComments
            postId={post.id}
            comments={comments}
            lang={ko ? "ko" : "en"}
            loggedIn={!!viewer}
          />
        )}
      </article>
    </div>
  );
}
