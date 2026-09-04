import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedSite, getPublishedPosts } from "@/lib/queries";
import { SiteRenderer } from "@/components/website/SiteRenderer";
import { TrackPageView } from "@/components/site/TrackPageView";
import { contactHref } from "@/components/website/templates/shared";
import { buildSeo, siteUrl } from "@/utils/seo";
import { stripHtml } from "@/utils/richtext";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) return { title: "페이지를 찾을 수 없습니다" };

  const c = site.website.content;
  return buildSeo({
    title: c.hero?.businessName ?? site.business.name,
    description:
      stripHtml(c.hero?.shortDescription ?? site.business.description ?? "") ||
      undefined,
    path: `/site/${slug}`,
    image: c.hero?.image,
  });
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) notFound();

  const posts = await getPublishedPosts(site.business.id);
  const blogHref = posts.length > 0 ? `/site/${slug}/blog` : undefined;
  // 랜딩페이지 하단 "최신 글" 섹션 — 클릭하면 해당 글로 이동한다.
  const latestPosts = posts.slice(0, 3).map((p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    coverImageUrl: p.cover_image_url,
    publishedAt: p.published_at,
    keyword: p.keywords[0],
  }));

  const c = site.website.content;
  // 검색·AI 답변엔진(AEO)용 구조화 데이터
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: c.hero?.businessName ?? site.business.name,
    description:
      stripHtml(c.hero?.shortDescription || site.business.description || "") ||
      undefined,
    url: `${siteUrl}/site/${slug}`,
    image: c.hero?.image || undefined,
    telephone: c.contact?.phone || undefined,
    email: c.contact?.email || undefined,
    address: c.contact?.address || undefined,
    sameAs: (["instagram", "facebook", "x"] as const)
      .map((k) => (c.contact?.[k] ? contactHref(k, c.contact[k]!) : null))
      .filter(Boolean),
  };

  return (
    <>
      <TrackPageView slug={slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteRenderer
        content={site.website.content}
        blogHref={blogHref}
        latestPosts={latestPosts}
      />
    </>
  );
}
