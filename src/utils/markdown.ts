import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

/**
 * CommonMark는 굵게(**)의 닫는 구분자가 한글 조사 등과 붙어 있으면
 * (예: `**발효종**은`) 강조로 파싱하지 못한다. 해당 패턴만 미리
 * <strong>으로 변환한다 — 내부 마크다운(기울임 등)은 계속 파싱된다.
 */
export function fixCjkBold(md: string): string {
  return md.replace(/\*\*([^*\n]+?)\*\*(?=[가-힣])/g, "<strong>$1</strong>");
}

/** Render trusted (owner-authored) markdown to HTML for public blog pages. */
export async function renderMarkdown(md: string): Promise<string> {
  return marked.parse(fixCjkBold(md ?? ""));
}
