import type { Metadata } from "next";

interface SeoInput {
  title: string;
  description?: string | null;
  keywords?: string[];
  path: string; // e.g. /site/cafe-moment
  image?: string;
  /** OpenGraph 타입 — 블로그 글은 "article". */
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
}

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Builds Next.js Metadata (title, description, OG, keywords) for public pages. */
export function buildSeo({
  title,
  description,
  keywords,
  path,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
}: SeoInput): Metadata {
  const url = `${siteUrl}${path}`;
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
