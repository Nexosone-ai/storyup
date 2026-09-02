import type { MetadataRoute } from "next";
import { getShowcaseSites, getShowcasePosts } from "@/lib/queries";
import { siteUrl } from "@/utils/seo";

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

  return [...staticPages, ...sitePages, ...postPages];
}
