import type { WebsiteRow } from "@/types/database";
import type { WebsiteContent, CardNewsResult } from "@/types/domain";
import type { ShowcasePost, ShowcaseCard } from "@/lib/queries";

/** 직렬화 가능한 쇼케이스 카드 데이터 (서버에서 만들어 클라이언트 탭으로 전달) */
export interface ShowcaseSiteItem {
  href: string;
  name: string;
  headline: string;
  image: string | null;
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
  return {
    href: `/site/${site.slug}`,
    name: content.hero?.businessName ?? "",
    headline: content.hero?.headline ?? "",
    image: content.hero?.image ?? null,
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

export interface ShowcaseCardItem {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  businessName: string;
  image: string | null;
  handle: string;
  cardNews: CardNewsResult;
}

export function toCardItem(card: ShowcaseCard): ShowcaseCardItem {
  return {
    id: card.id,
    href: `/site/${card.siteSlug}`,
    title: card.title,
    subtitle: card.subtitle,
    businessName: card.businessName,
    image: card.image,
    handle: `@${card.siteSlug}`,
    cardNews: card.cardNews,
  };
}
