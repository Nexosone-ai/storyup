/**
 * 블로그 글 안의 "앨범 플레이어" 삽입 마커(2026-11-11).
 * 아티스트(음악) 사이트의 musicAlbum 섹션을 블로그 글에서도 회전 LP 플레이어로 보여준다.
 * - 마커 없음: 글 상단(커버 아래)에 자동 표시.
 * - 본문에 "[[album]]" 단락: 그 자리에 표시(위지윅 툴바 '앨범 플레이어' 버튼이 삽입).
 * - 본문에 "[[album:off]]": 이 글에서는 숨김.
 * DB 변경 없이 본문 텍스트만으로 제어한다. 공개 렌더(renderBlogContent) 결과 HTML에서 분리한다.
 */
export const ALBUM_MARKER = "[[album]]";
export const ALBUM_OFF_MARKER = "[[album:off]]";

// 마커를 감싼 단락(<p>, 인라인 태그 포함) 또는 맨 텍스트 둘 다 인식.
const MARKER_P = /<p[^>]*>(?:\s|<[^>]+>)*\[\[album(?::off)?\]\](?:\s|<[^>]+>)*<\/p>/gi;
const MARKER_TEXT = /\[\[album(?::off)?\]\]/gi;
const OFF_RE = /\[\[album:off\]\]/i;

/**
 * 렌더된 본문 HTML을 앨범 마커 기준으로 나눈다.
 * parts 길이가 2 이상이면 마커 위치에 플레이어를 끼워 넣고, 1이면 마커가 없던 것.
 */
export function splitAlbumMarker(html: string): { parts: string[]; off: boolean } {
  const src = html ?? "";
  const off = OFF_RE.test(src);
  if (off) {
    return { parts: [src.replace(MARKER_P, "").replace(MARKER_TEXT, "")], off: true };
  }
  const token = "\u0000ALBUM\u0000";
  const marked = src.replace(MARKER_P, token).replace(MARKER_TEXT, token);
  const parts = marked.split(token);
  if (parts.length === 1) return { parts, off: false };
  // 연속 마커는 하나로 — 첫 마커 위치에만 플레이어를 둔다.
  return { parts: [parts[0], parts.slice(1).join("")], off: false };
}
