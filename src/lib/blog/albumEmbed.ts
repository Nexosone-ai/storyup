/**
 * 블로그 글 안의 "앨범 플레이어" 삽입 마커(2026-11-11).
 * 아티스트(음악) 사이트의 musicAlbum 섹션을 블로그 글에서도 회전 LP 플레이어로 보여준다.
 * - 마커 없음: 첫 번째 앨범을 글 상단(커버 아래)에 자동 표시.
 * - "[[album]]" 단락: 그 자리에 첫 번째 앨범. "[[album:2]]": 두 번째 앨범(사이트 섹션 순서, 1부터).
 * - "[[album:2:3]]": 두 번째 앨범을 3번 곡이 선택된 상태로.
 * - "[[album:off]]": 이 글에서는 숨김.
 * DB 변경 없이 본문 텍스트만으로 제어한다. 공개 렌더(renderBlogContent) 결과 HTML에서 분리한다.
 */
export const ALBUM_MARKER = "[[album]]";
export const ALBUM_OFF_MARKER = "[[album:off]]";

/** 앨범 n번(1부터)·곡 t번(선택) 마커 문자열. */
export function albumMarker(album?: number, track?: number): string {
  if (!album || album < 1) return ALBUM_MARKER;
  return track && track > 0 ? `[[album:${album}:${track}]]` : `[[album:${album}]]`;
}

const ARG = "(?::(off|\\d+(?::\\d+)?))?";
// 마커를 감싼 단락(<p>, 인라인 태그 포함) 또는 맨 텍스트 둘 다 인식.
const MARKER_P = new RegExp(`<p[^>]*>(?:\\s|<[^>]+>)*\\[\\[album${ARG}\\]\\](?:\\s|<[^>]+>)*</p>`, "gi");
const MARKER_TEXT = new RegExp(`\\[\\[album${ARG}\\]\\]`, "gi");
const OFF_RE = /\[\[album:off\]\]/i;
const PICK_RE = /\[\[album:(\d+)(?::(\d+))?\]\]/i;

export interface AlbumSplit {
  /** 마커 앞/뒤 HTML. 길이 1이면 마커 없음. */
  parts: string[];
  off: boolean;
  /** 선택한 앨범 번호(1부터, 기본 1). */
  album: number;
  /** 선택한 곡 번호(1부터, 기본 1). */
  track: number;
  /** [[album:N]] 처럼 앨범 번호를 명시했는지. false 면 모든 앨범의 곡을 합친 LP판 하나. */
  picked: boolean;
}

/**
 * 렌더된 본문 HTML을 앨범 마커 기준으로 나눈다.
 * parts 길이가 2 이상이면 마커 위치에 플레이어를 끼워 넣고, 1이면 마커가 없던 것.
 */
export function splitAlbumMarker(html: string): AlbumSplit {
  const src = html ?? "";
  const off = OFF_RE.test(src);
  const pick = src.match(PICK_RE);
  const picked = !!pick;
  const album = Math.max(1, Number(pick?.[1] ?? 1) || 1);
  const track = Math.max(1, Number(pick?.[2] ?? 1) || 1);
  if (off) {
    return {
      parts: [src.replace(MARKER_P, "").replace(MARKER_TEXT, "")],
      off: true,
      album,
      track,
      picked,
    };
  }
  const token = "\u0000ALBUM\u0000";
  const marked = src.replace(MARKER_P, token).replace(MARKER_TEXT, token);
  const parts = marked.split(token);
  if (parts.length === 1) return { parts, off: false, album, track, picked };
  // 연속 마커는 하나로 — 첫 마커 위치에만 플레이어를 둔다.
  return { parts: [parts[0], parts.slice(1).join("")], off: false, album, track, picked };
}
