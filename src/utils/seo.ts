import type { Metadata } from "next";

interface SeoInput {
  title: string;
  description?: string | null;
  keywords?: string[];
  path: string; // e.g. /site/cafe-moment
  image?: string;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Builds Next.js Metadata (title, description, OG, keywords) for public pages. */
export function buildSeo({
  title,
  description,
  keywords,
  path,
}: SeoInput): Metadata {
  const url = `${siteUrl}${path}`;
  const desc = description?.slice(0, 160) ?? undefined;
  return {
    title,
    description: desc,
    keywords: keywords && keywords.length ? keywords : undefined,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
      type: "website",
      siteName: "STORYUP",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
    },
  };
}
