import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

/**
 * GFM 취소선(~) 비활성화 — 한국어 본문의 "25~30%", "2~3일", "오후 2시~5시"
 * 같은 물결 표기가 취소선으로 파싱되어 사이 글자에 줄이 그어지는 문제.
 * 에디터에 취소선 버튼도 없으므로 del 토큰을 통째로 끈다.
 * (BlogEditor도 이 모듈을 import하므로 전역 marked에 함께 적용된다.)
 */
marked.use({
  tokenizer: {
    del() {
      return undefined;
    },
  },
});

/**
 * CommonMark는 굵게(**)의 닫는 구분자가 한글 조사 등과 붙어 있으면
 * (예: `**발효종**은`) 강조로 파싱하지 못한다. 해당 패턴만 미리
 * <strong>으로 변환한다 — 내부 마크다운(기울임 등)은 계속 파싱된다.
 */
export function fixCjkBold(md: string): string {
  return md.replace(/\*\*([^*\n]+?)\*\*(?=[가-힣])/g, "<strong>$1</strong>");
}

/** 한 줄에 URL만 있는 유튜브 링크에서 영상 ID를 뽑는다. */
function youtubeId(line: string): string | null {
  const m = line.match(
    /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,20})\S*$/,
  );
  return m ? m[1] : null;
}

/**
 * 본문 중 단독 줄로 적힌 유튜브 링크를 반응형 임베드로 바꾼다.
 * (에디터의 "영상" 버튼이 링크를 단독 줄로 넣는다.)
 */
export function embedVideos(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      const id = youtubeId(line.trim());
      if (!id) return line;
      return (
        `<div style="position:relative;width:100%;aspect-ratio:16/9;margin:1.5em 0;">` +
        `<iframe src="https://www.youtube.com/embed/${id}" ` +
        `title="YouTube video" loading="lazy" allowfullscreen ` +
        `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
        `style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px;"></iframe>` +
        `</div>`
      );
    })
    .join("\n");
}

/** 렌더링 전 공통 전처리 (에디터 미리보기·공개 페이지 공용). */
export function preprocessMarkdown(md: string): string {
  return embedVideos(fixCjkBold(md ?? ""));
}

/**
 * 마크다운을 순수 텍스트로 변환한다 — 네이버 블로그 등
 * 외부 편집기에 붙여넣을 본문 복사용 (클라이언트 안전, 의존성 없음).
 */
export function markdownToPlainText(md: string): string {
  return (md ?? "")
    .replace(/```\w*\n?/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)([^*_]+)\1/g, "$2")
    .replace(/(^|[^*_])[*_]([^*_\n]+)[*_]/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "· ")
    .replace(/^ {0,3}([-*_][ \t]*){3,}$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Render trusted (owner-authored) markdown to HTML for public blog pages. */
export async function renderMarkdown(md: string): Promise<string> {
  const html = await marked.parse(preprocessMarkdown(md));
  // 본문 이미지는 접힌 화면 밖이므로 lazy load — LCP(커버 이미지)에 영향 없음.
  return html.replace(/<img /g, '<img loading="lazy" decoding="async" ');
}
