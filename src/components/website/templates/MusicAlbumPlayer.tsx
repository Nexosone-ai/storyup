"use client";

import { useRef, useState } from "react";
import type { SiteTrackItem } from "@/types/domain";
import { storageThumb } from "@/utils/storageImage";

const SPIN_CSS = `
@keyframes mapspin{to{transform:rotate(360deg)}}
.map-disc{animation:mapspin 8s linear infinite}
.map-disc.paused{animation-play-state:paused}
@media (prefers-reduced-motion:reduce){.map-disc{animation:none}}
`;

/** 기본 LP 그래픽(커버 이미지 없을 때) — 인라인 SVG. */
function DefaultDisc() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#1a1a1a" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#333" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#333" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="22" fill="none" stroke="#333" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="15" fill="var(--primary)" />
      <circle cx="50" cy="50" r="4" fill="#111" />
    </svg>
  );
}

/**
 * 공개 사이트 음악 앨범 플레이어 — 커버(LP)가 재생 중 회전, 트랙 선택, 선택 곡의
 * 가사·이야기 표시. 이미지 변환 엔드포인트(/render/image)는 쓰지 않고 원본 URL 사용.
 */
export function MusicAlbumPlayer({
  title,
  coverImage,
  story,
  tracks,
  compact = false,
}: {
  title?: string;
  coverImage?: string;
  story?: string;
  tracks: SiteTrackItem[];
  /** 블로그 글 삽입용 — 섹션 테두리·여백 없이 작은 LP(앨범 이야기는 생략). */
  compact?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);

  const track = tracks[current];
  const cover = coverImage ? storageThumb(coverImage) : null;

  const selectTrack = (i: number) => {
    setCurrent(i);
    // 트랙 전환 후 재생(소스는 key 변경으로 리로드됨).
    requestAnimationFrame(() => {
      const el = audioRef.current;
      if (el && tracks[i]?.audioUrl) {
        el.play().catch(() => {});
      }
    });
  };

  const Wrapper: "section" | "div" = compact ? "div" : "section";
  return (
    <Wrapper
      className={
        compact
          ? "not-prose rounded-2xl border border-border bg-surface/50"
          : "border-t border-border"
      }
    >
      <style>{SPIN_CSS}</style>
      <div className={compact ? "px-5 py-8" : "mx-auto max-w-3xl px-5 py-16"}>
        {title &&
          (compact ? (
            <h3 className="mb-5 text-center text-lg font-semibold tracking-tight">
              {title}
            </h3>
          ) : (
            <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">
              {title}
            </h2>
          ))}

        {/* 회전 커버 */}
        <div className="flex justify-center">
          <div
            className={`relative aspect-square max-w-full ${
              compact ? "w-40 sm:w-48" : "w-56 sm:w-64"
            }`}
          >
            <div
              className={`map-disc h-full w-full overflow-hidden rounded-full border border-border shadow-lg ${
                playing ? "" : "paused"
              }`}
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt={title ?? "album cover"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <DefaultDisc />
              )}
            </div>
            {/* 중앙 홀 */}
            <span className="pointer-events-none absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-inner" />
          </div>
        </div>

        {story && !compact && (
          <p className="mx-auto mt-6 max-w-xl whitespace-pre-wrap text-center leading-relaxed text-muted">
            {story}
          </p>
        )}

        {/* 오디오 컨트롤 */}
        {track?.audioUrl ? (
          <div className="mt-6">
            <audio
              key={track.audioUrl}
              ref={audioRef}
              controls
              preload="none"
              src={track.audioUrl}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              className="mx-auto w-full max-w-md"
            >
              <track kind="captions" />
            </audio>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-muted">
            아직 등록된 음원이 없습니다.
          </p>
        )}

        {/* 트랙 목록(2곡 이상일 때) */}
        {tracks.length > 1 && (
          <ol className="mx-auto mt-6 max-w-md divide-y divide-border rounded-xl border border-border">
            {tracks.map((t, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => selectTrack(i)}
                  disabled={!t.audioUrl}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                    i === current ? "bg-primary-soft text-primary" : "hover:bg-surface"
                  } ${t.audioUrl ? "" : "opacity-50"}`}
                >
                  <span className="w-5 shrink-0 tabular-nums text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {t.title || `Track ${i + 1}`}
                  </span>
                  {i === current && playing && (
                    <span className="shrink-0 text-xs">▶</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        )}

        {/* 선택 곡 가사 + 이야기 */}
        {(track?.lyrics || track?.story) && (
          <div className="mx-auto mt-8 max-w-xl space-y-6">
            {tracks.length > 1 && track.title && (
              <h3 className="text-center text-lg font-semibold">{track.title}</h3>
            )}
            {track.lyrics && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  가사
                </p>
                <p className="whitespace-pre-wrap text-center leading-relaxed text-foreground/85">
                  {track.lyrics}
                </p>
              </div>
            )}
            {track.story && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  이 곡의 이야기
                </p>
                <p className="whitespace-pre-wrap leading-relaxed text-foreground/85">
                  {track.story}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Wrapper>
  );
}
