import type { WebsiteRow } from "@/types/database";
import type { WebsiteContent, CardNewsResult } from "@/types/domain";
import type { ShowcasePost, ShowcaseCard } from "@/lib/queries";
import { stripHtml } from "@/utils/richtext";

/** 미리보기 슬라이드 한 장 — 사진 + 그 화면의 문구(있으면 오버레이). */
export interface ShowcaseSlide {
  src: string;
  caption: string;
}

/** 직렬화 가능한 쇼케이스 카드 데이터 (서버에서 만들어 클라이언트 탭으로 전달) */
export interface ShowcaseSiteItem {
  href: string;
  name: string;
  headline: string;
  logo: string | null;
  /** 카드 슬라이드 미리보기 — 히어로 → 서비스 → 특장점 → 갤러리 순, 최대 6장. */
  slides: ShowcaseSlide[];
}

export interface ShowcasePostItem {
  href: string;
  title: string;
  summary: string;
  cover: string | null;
  businessName: string;
  /** 누적 조회수 (0015 마이그레이션 이전 데이터는 0) */
  views: number;
  /** 좋아요 수 (0018 마이그레이션 이전 데이터는 0) */
  likes: number;
  /** 댓글 수 */
  comments: number;
  /** 조회수 1위 글에만 채워지는 뱃지 문구 (로케일 반영) */
  hotLabel?: string;
}

export function toSiteItem(site: WebsiteRow): ShowcaseSiteItem {
  const content = site.content as WebsiteContent;
  // 슬라이드 미리보기: 히어로 → 서비스 → 특장점 → 갤러리 순으로 사진+문구를 모아
  // 중복 사진 제거, 최대 6장.
  const raw: ShowcaseSlide[] = [
    { src: content.hero?.image ?? "", caption: stripHtml(content.hero?.headline ?? "") },
    ...(content.offers?.items ?? []).map((i) => ({
      src: i.image ?? "",
      caption: stripHtml(i.title ?? ""),
    })),
    ...(content.whyChooseUs?.items ?? []).map((i) => ({
      src: i.image ?? "",
      caption: stripHtml(i.title ?? ""),
    })),
    ...(content.gallery ?? []).map((src) => ({ src, caption: "" })),
  ];
  const slides: ShowcaseSlide[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    if (!s.src || seen.has(s.src)) continue;
    seen.add(s.src);
    slides.push(s);
    if (slides.length >= 6) break;
  }
  return {
    href: `/site/${site.slug}`,
    name: content.hero?.businessName ?? "",
    headline: stripHtml(content.hero?.headline ?? ""),
    logo: content.hero?.logo ?? null,
    slides,
  };
}

export function toPostItem(
  item: ShowcasePost,
  engagement?: Map<string, { comments: number; likes: number }>,
): ShowcasePostItem {
  const e = engagement?.get(item.post.id);
  return {
    href: `/site/${item.siteSlug}/blog/${item.post.slug}`,
    title: item.post.title,
    summary: item.post.summary ?? "",
    cover: item.post.cover_image_url ?? null,
    businessName: item.businessName,
    views: item.post.view_count ?? 0,
    likes: e?.likes ?? 0,
    comments: e?.comments ?? 0,
  };
}

/** 조회수가 가장 많은 글(1개)에 인기글 뱃지 문구를 단다 — 조회수 0뿐이면 없음. */
export function markHotPost(
  items: ShowcasePostItem[],
  label: string,
): ShowcasePostItem[] {
  const max = Math.max(0, ...items.map((i) => i.views));
  if (max <= 0) return items;
  const hotIndex = items.findIndex((i) => i.views === max);
  return items.map((i, idx) =>
    idx === hotIndex ? { ...i, hotLabel: label } : i,
  );
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
