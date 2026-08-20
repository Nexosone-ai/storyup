import type { PublishChannel } from "@/types/domain";

export interface ExportablePost {
  title: string;
  slug: string;
  content: string | null;
  summary: string | null;
  keywords: string[];
  seo_title: string | null;
  seo_description: string | null;
}

export interface ExportedContent {
  text: string;
  filename: string;
}

/** Formats a blog post for a given channel's paste/import workflow. */
export function exportForChannel(
  post: ExportablePost,
  channel: PublishChannel,
): ExportedContent {
  const kw = post.keywords ?? [];
  const tags = kw.map((k) => `#${k}`).join(" ");
  const body = post.content ?? "";
  const filename = `${post.slug || "post"}-${channel}.md`;

  if (channel === "blogger") {
    const text = [
      `# ${post.title}`,
      "",
      body,
      "",
      "---",
      `라벨(Labels): ${kw.join(", ")}`,
      `SEO 제목: ${post.seo_title || post.title}`,
      `SEO 설명: ${post.seo_description || post.summary || ""}`,
    ].join("\n");
    return { text, filename };
  }

  if (channel === "tistory") {
    const text = [`# ${post.title}`, "", body, "", tags].join("\n");
    return { text, filename };
  }

  // naver — editor doesn't handle markdown well; give clean paste text.
  const text = [
    `제목: ${post.title}`,
    "",
    body,
    "",
    `태그: ${tags}`,
    "",
    "(네이버 블로그 글쓰기에 붙여넣은 뒤 서식과 이미지를 확인하세요.)",
  ].join("\n");
  return { text, filename };
}
