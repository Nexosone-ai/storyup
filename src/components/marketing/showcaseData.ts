import type { WebsiteRow } from "@/types/database";
import type { WebsiteContent } from "@/types/domain";
import { SITE_PALETTES } from "@/components/website/siteStyle";
import type { ShowcasePost } from "@/lib/queries";

/** 직렬화 가능한 쇼케이스 카드 데이터 (서버에서 만들어 클라이언트 탭으로 전달) */
export interface ShowcaseSiteItem {
  href: string;
  name: string;
  headline: string;
  image: string | null;
  /** 사이트가 고른 테마 색 (이미지 없을 때 프리뷰 배경) */
  color: string;
}

export interface ShowcasePostItem {
  href: string;
  title: string;
  summary: string;
  cover: string | null;
  businessName: string;
}

export function toSiteItem(site: WebsiteRow): ShowcaseSiteItem {
  const content = site.content as WebsiteContent;
  const palette =
    SITE_PALETTES.find((p) => p.id === content.style?.palette) ??
    SITE_PALETTES[0];
  return {
    href: `/site/${site.slug}`,
    name: content.hero?.businessName ?? "",
    headline: content.hero?.headline ?? "",
    image: content.hero?.image ?? null,
    color: palette.primary,
  };
}

export function toPostItem(item: ShowcasePost): ShowcasePostItem {
  return {
    href: `/site/${item.siteSlug}/blog/${item.post.slug}`,
    title: item.post.title,
    summary: item.post.summary ?? "",
    cover: item.post.cover_image_url ?? null,
    businessName: item.businessName,
  };
}
