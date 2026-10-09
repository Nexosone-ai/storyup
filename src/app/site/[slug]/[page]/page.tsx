import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedSite, getPublishedPosts, getUser } from "@/lib/queries";
import { SubPageRenderer } from "@/components/website/SubPageRenderer";
import { TrackPageView } from "@/components/site/TrackPageView";
import { buildSeo, siteBaseUrl } from "@/utils/seo";
import { stripHtml } from "@/utils/richtext";
import type { SitePage } from "@/types/domain";

// blog/ads.txt 등은 정적 라우트가 우선 처리하지만, 방어적으로 한 번 더 막는다.
const RESERVED = new Set(["blog", "ads.txt", "sitemap.xml", "robots.txt"]);

function findPage(
  pages: SitePage[] | undefined,
  slug: string,
): SitePage | null {
  return (pages ?? []).find((p) => p.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}): Promise<Metadata> {
  const { slug, page } = await params;
  if (RESERVED.has(page)) return { title: "페이지를 찾을 수 없습니다" };
  const site = await getPublishedSite(slug);
  const sp = site && findPage(site.website.content.pages, page);
  if (!site || !sp) return { title: "페이지를 찾을 수 없습니다" };

  const c = site.website.content;
  return buildSeo({
    title:
      sp.seo?.title ||
      `${sp.navLabel} · ${c.hero?.businessName ?? site.business.name}`,
    description:
      stripHtml(sp.seo?.description ?? sp.hero?.shortDescription ?? "") ||
      undefined,
    path: `/site/${slug}/${page}`,
    url: `${siteBaseUrl(site.primaryDomain, slug)}/${page}`,
    image: sp.hero?.image ?? c.hero?.image,
  });
}

export default async function PublicSubPage({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}) {
  const { slug, page } = await params;
  if (RESERVED.has(page)) notFound();

  const site = await getPublishedSite(slug);
  if (!site) notFound();
  const sp = findPage(site.website.content.pages, page);
  if (!sp) notFound();

  const posts = await getPublishedPosts(site.business.id);
  const blogHref = posts.length > 0 ? `/site/${slug}/blog` : undefined;
  const viewer = await getUser();
  const editHref =
    viewer && viewer.id === site.business.user_id
      ? `/business/${site.business.id}/website`
      : undefined;

  return (
    <>
      <TrackPageView slug={slug} />
      <SubPageRenderer
        content={site.website.content}
        page={sp}
        siteSlug={slug}
        blogHref={blogHref}
        editHref={editHref}
      />
    </>
  );
}
