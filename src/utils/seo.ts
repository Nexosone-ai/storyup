import type { Metadata } from "next";

interface SeoInput {
  title: string;
  description?: string | null;
  keywords?: string[];
  path: string; // e.g. /site/cafe-moment
  /** 절대 canonical/OG URL 오버라이드 — 커스텀 도메인 연결 시 그 도메인 주소를 넘긴다. */
  url?: string;
  image?: string;
  /** OpenGraph 타입 — 블로그 글은 "article". */
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
}

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * 공개 사이트의 정규(canonical) base URL.
 * 커스텀 도메인이 연결돼 있으면 그 도메인(https://myshop.com), 아니면 STORYUP 경로.
 * (커스텀 도메인에서는 /blog/... 처럼 도메인 루트 기준 경로를 붙인다.)
 */
export function siteBaseUrl(primaryDomain: string | null, slug: string): string {
  return primaryDomain ? `https://${primaryDomain}` : `${siteUrl}/site/${slug}`;
}

/** Builds Next.js Metadata (title, description, OG, keywords) for public pages. */
export function buildSeo({
  title,
  description,
  keywords,
  path,
  url: urlOverride,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
}: SeoInput): Metadata {
  const url = urlOverride ?? `${siteUrl}${path}`;
  const desc = description?.slice(0, 160) ?? undefined;
  return {
    title,
    description: desc,
    keywords: keywords && keywords.length ? keywords : undefined,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description: desc,
      url,
      type,
      siteName: "STORYUP",
      locale: "ko_KR",
      ...(image ? { images: [{ url: image }] } : {}),
      ...(type === "article"
        ? { publishedTime, modifiedTime }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      ...(image ? { images: [image] } : {}),
    },
  };
}
