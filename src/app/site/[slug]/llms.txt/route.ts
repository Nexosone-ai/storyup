import { getPublishedSite, getPublishedPosts } from "@/lib/queries";
import { siteBaseUrl } from "@/utils/seo";

/**
 * 사이트별 llms.txt — LLM/답변엔진이 이 브랜드의 핵심 정보·공개 글을 쉽게 찾아
 * 인용하도록 돕는 머신 리더블 인덱스(fire-your-seo-agency의 LLMO/AEO 항목).
 * 커스텀 도메인 요청은 미들웨어가 /llms.txt → /site/{slug}/llms.txt 로 rewrite한다.
 * 미게시면 404.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) {
    return new Response("", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const base = siteBaseUrl(site.primaryDomain, slug);
  const content = site.website.content;
  const name =
    content.hero?.businessName?.trim() || site.business.name?.trim() || slug;
  const tagline =
    content.hero?.shortDescription?.trim() ||
    content.story?.body?.trim().slice(0, 200) ||
    "";

  const posts = await getPublishedPosts(site.business.id);
  const lines: string[] = [];
  lines.push(`# ${name}`);
  if (tagline) lines.push(`> ${tagline.replace(/\s+/g, " ")}`);
  lines.push("");
  lines.push(`홈페이지: ${base}`);
  lines.push("");

  if (posts.length > 0) {
    lines.push("## 블로그 글");
    for (const p of posts.slice(0, 200)) {
      const url = `${base}/blog/${p.slug}`;
      const desc = (p.seo_description || p.summary || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
      lines.push(desc ? `- [${p.title}](${url}): ${desc}` : `- [${p.title}](${url})`);
    }
    lines.push("");
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
