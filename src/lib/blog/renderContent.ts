import "server-only";
import sanitizeHtml from "sanitize-html";
import { renderMarkdown, looksLikeHtml } from "@/utils/markdown";

/**
 * 블로그 본문 공개 렌더링 — 레거시 마크다운과 위지윅(TipTap) HTML을 모두 처리한다.
 * - 마크다운: 기존 renderMarkdown 경로(marked + 유튜브 임베드).
 * - HTML: 위지윅이 저장한 HTML을 화이트리스트 기반으로 새니타이즈 후 렌더.
 *   (현재 본문엔 새니타이즈가 전혀 없었으므로, HTML 저장 도입과 함께 보안 추가.)
 * 유튜브 iframe은 허용 호스트로 제한, 음악은 audio 태그만 허용한다.
 */

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "mark", "span", "sub", "sup",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td",
    "div", "iframe", "audio", "source",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
    span: ["style"],
    p: ["style"],
    h1: ["style"], h2: ["style"], h3: ["style"],
    h4: ["style"], h5: ["style"], h6: ["style"],
    li: ["style"], td: ["style"], th: ["style"],
    div: ["style", "data-youtube-video"],
    iframe: [
      "src", "allow", "allowfullscreen", "frameborder",
      "title", "loading", "width", "height", "style",
    ],
    audio: ["src", "controls"],
    source: ["src", "type"],
  },
  allowedStyles: {
    "*": {
      "font-size": [/^\d{1,3}(\.\d+)?(px|em|rem|%)$/],
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/, /^[a-z]+$/],
      "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(/, /^rgba\(/, /^[a-z]+$/],
      "text-align": [/^(left|right|center|justify)$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  // 유튜브 외 iframe은 제거 (오디오는 audio 태그로만 허용).
  allowedIframeHostnames: [
    "www.youtube.com",
    "youtube.com",
    "www.youtube-nocookie.com",
    "youtube-nocookie.com",
  ],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
      target: "_blank",
    }),
  },
};

export function sanitizeBlogHtml(html: string): string {
  return sanitizeHtml(html ?? "", SANITIZE_OPTS);
}

/** 본문(마크다운 또는 위지윅 HTML)을 공개용 안전 HTML로 렌더한다. */
export async function renderBlogContent(content: string): Promise<string> {
  if (looksLikeHtml(content)) {
    return sanitizeBlogHtml(content).replace(
      /<img /g,
      '<img loading="lazy" decoding="async" ',
    );
  }
  return renderMarkdown(content ?? "");
}
