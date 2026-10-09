import type { MetadataRoute } from "next";
import { getShowcaseSites, getShowcasePosts } from "@/lib/queries";
import { siteUrl } from "@/utils/seo";
import type { WebsiteContent } from "@/types/domain";

export const revalidate = 3600; // 1시간마다 갱신

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [sites, posts] = await Promise.all([
    getShowcaseSites(1000),
    getShowcasePosts(1000),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/showcase`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/community`, changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/pricing`, changeFrequency: "monthly", priority: 0.8 },
  ];

  const sitePages: MetadataRoute.Sitemap = sites.map((s) => ({
    url: `${siteUrl}/site/${s.slug}`,
    lastModified: s.updated_at,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const postPages: MetadataRoute.Sitemap = posts.map(({ post, siteSlug }) => ({
    url: `${siteUrl}/site/${siteSlug}/blog/${post.slug}`,
    lastModified: post.updated_at,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // (멀티페이지) 사이트별 하위 페이지
  const subPages: MetadataRoute.Sitemap = sites.flatMap((s) => {
    const pages = (s.content as WebsiteContent | null)?.pages ?? [];
    return pages
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${siteUrl}/site/${s.slug}/${p.slug}`,
        lastModified: s.updated_at,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
  });

  return [...staticPages, ...sitePages, ...postPages, ...subPages];
}
