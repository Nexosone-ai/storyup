import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedSite, getPublishedPosts } from "@/lib/queries";
import { SiteRenderer } from "@/components/website/SiteRenderer";
import { buildSeo } from "@/utils/seo";

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
    description: c.hero?.shortDescription ?? site.business.description,
    path: `/site/${slug}`,
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

  return (
    <SiteRenderer content={site.website.content} blogHref={blogHref} />
  );
}
