import type { MetadataRoute } from "next";
import { getShowcaseSites, getShowcasePosts } from "@/lib/queries";
import { listPublishedIndustrySlugs } from "@/lib/industries";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { siteUrl } from "@/utils/seo";
import type { WebsiteContent } from "@/types/domain";

export const revalidate = 3600; // 1시간마다 갱신

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [sites, posts, industries] = await Promise.all([
    getShowcaseSites(1000),
    getShowcasePosts(1000),
    listPublishedIndustrySlugs(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/industries`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/showcase`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/community`, changeFrequency: "daily", priority: 0.7 },
    // B2B2C 모드에선 공개 요금표를 색인하지 않는다(도입 문의 페이지로 전환).
    ...(B2B2C_ENABLED
      ? []
      : [
          {
            url: `${siteUrl}/pricing`,
            changeFrequency: "monthly" as const,
            priority: 0.8,
          },
        ]),
  ];

  // 공개된 업종 소개 페이지만(초안·요청 페이지는 제외).
  const industryPages: MetadataRoute.Sitemap = industries.map((i) => ({
    url: `${siteUrl}/industries/${i.slug}`,
    lastModified: i.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

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

  return [...staticPages, ...industryPages, ...sitePages, ...postPages, ...subPages];
}
