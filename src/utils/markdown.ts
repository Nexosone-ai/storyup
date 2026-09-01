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

/** Render trusted (owner-authored) markdown to HTML for public blog pages. */
export async function renderMarkdown(md: string): Promise<string> {
  return marked.parse(preprocessMarkdown(md));
}
