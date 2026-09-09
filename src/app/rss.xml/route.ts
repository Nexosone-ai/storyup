import { getShowcasePosts } from "@/lib/queries";
import { renderMarkdown } from "@/utils/markdown";
import { siteUrl } from "@/utils/seo";

/**
 * 네이버 서치어드바이저 등 검색엔진용 RSS 2.0 피드 (/rss.xml).
 * published 상태이고 그 사이트도 published인 공개 블로그 글만 최신순으로 담는다
 * (getShowcasePosts가 익명 RLS 공개 읽기로 이 조건을 이미 강제한다).
 *
 * 커스텀 Route Handler는 기본적으로 캐시되지 않으므로 force-static으로 캐싱을
 * 명시하고 revalidate로 갱신 주기를 둔다. force-static 하에서 cookies()는 빈 값을
 * 반환해 익명 클라이언트로 동작한다.
 */
export const dynamic = "force-static";
export const revalidate = 600; // 10분마다 갱신 — 새 글이 지나치게 늦게 반영되지 않게.

/** 피드에 담을 최신 공개 글 최대 개수. */
const FEED_SIZE = 50;

/** XML 텍스트 노드용 이스케이프 (&, <, >, ", '). */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 본문 HTML을 CDATA로 안전하게 감싼다 — 내부의 "]]>"는 분할해 조기 종료를 막는다. */
function cdata(s: string): string {
  return `<![CDATA[${s.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

export async function GET(): Promise<Response> {
  const posts = await getShowcasePosts(FEED_SIZE);

  const items = await Promise.all(
    posts.map(async ({ post, siteSlug }) => {
      // 모든 링크는 www 절대경로 (siteUrl = https://www.storyup.me).
      const url = `${siteUrl}/site/${siteSlug}/blog/${post.slug}`;
      const pubDate = new Date(
        post.published_at ?? post.created_at,
      ).toUTCString(); // RFC 822/1123
      const description = post.seo_description || post.summary || post.title;
      const contentHtml = await renderMarkdown(post.content ?? "");
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <description>${cdata(description)}</description>`,
        `      <content:encoded>${cdata(contentHtml)}</content:encoded>`,
        "    </item>",
      ].join("\n");
    }),
  );

  const lastBuildDate = new Date(
    posts[0]?.post.published_at ?? Date.now(),
  ).toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>STORYUP</title>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <description>STORYUP에서 발행된 최신 스토리와 블로그 콘텐츠</description>
    <language>ko</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
