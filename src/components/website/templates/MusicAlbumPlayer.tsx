"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const btn =
  "rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground/80 hover:bg-surface disabled:opacity-40";

/**
 * 공개 사이트 음악 앨범 플레이어 — **LP판 하나**가 재생 중 회전하고, 아래 곡 목록(순서 표시)에서
 * 곡을 고르거나 ▲▼로 듣는 순서를 바꾸며, 한 곡이 끝나면 목록 순서대로 다음 곡을 이어서 튼다(2026-11-11).
 * 순서 변경은 방문자의 브라우저에서만 적용된다(저장 안 함). 선택 곡의 가사·이야기 표시.
 * 이미지 변환 엔드포인트(/render/image)는 쓰지 않고 원본 URL 사용.
 */
export function MusicAlbumPlayer({
  title,
  coverImage,
  story,
  tracks,
  compact = false,
  initialTrack = 0,
}: {
  title?: string;
  coverImage?: string;
  story?: string;
  tracks: SiteTrackItem[];
  /** 블로그 글 삽입용 — 섹션 테두리·여백 없이 작은 LP(앨범 이야기는 생략). */
  compact?: boolean;
  /** 처음 선택된 곡(0부터, 원본 순서 기준). 범위를 벗어나면 첫 곡. */
  initialTrack?: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  // 듣는 순서(원본 인덱스 배열) — 방문자가 ▲▼로 바꿀 수 있다.
  const [order, setOrder] = useState<number[]>(() => tracks.map((_, i) => i));
  // 현재 곡 = 원본 인덱스.
  const [current, setCurrent] = useState(
    initialTrack >= 0 && initialTrack < tracks.length ? initialTrack : 0,
  );
  const [playing, setPlaying] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  // 사용자가 곡을 고른 뒤 소스가 바뀌면 자동 재생(첫 로드에는 재생하지 않음).
  const wantPlay = useRef(false);

  // 트랙 수가 바뀌면(에디터 미리보기) 렌더 시점에 순서를 다시 맞춘다(effect 에서 setState 하지 않음).
  const effOrder = useMemo(() => {
    const kept = order.filter((i) => i < tracks.length);
    for (let i = 0; i < tracks.length; i++) if (!kept.includes(i)) kept.push(i);
    return kept;
  }, [order, tracks.length]);

  const track = tracks[current];
  const cover = coverImage ? storageThumb(coverImage) : null;
  const pos = Math.max(0, effOrder.indexOf(current));
  const playable = useMemo(
    () => effOrder.filter((i) => !!tracks[i]?.audioUrl),
    [effOrder, tracks],
  );

  const goTo = (idx: number, play = true) => {
    setCurrent(idx);
    wantPlay.current = play;
  };
  const step = (dir: 1 | -1) => {
    if (playable.length === 0) return;
    const at = playable.indexOf(current);
    const next = playable[(at + dir + playable.length) % playable.length];
    goTo(next, true);
  };
  const move = (origIdx: number, dir: -1 | 1) => {
    setOrder(() => {
      const prev = effOrder;
      const i = prev.indexOf(origIdx);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // 소스 교체 후 재생 요청이 있으면 재생.
  useEffect(() => {
    if (!wantPlay.current) return;
    wantPlay.current = false;
    const el = audioRef.current;
    if (el && track?.audioUrl) el.play().catch(() => {});
  }, [current, track?.audioUrl]);

  const Wrapper: "section" | "div" = compact ? "div" : "section";
  const hasList = tracks.length > 1;

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

        {/* 회전 커버 — LP판 하나 */}
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

        {/* 현재 곡 */}
        {track && (
          <p className="mt-4 text-center text-sm font-semibold">
            {hasList && (
              <span className="mr-1.5 tabular-nums text-muted">
                {pos + 1}/{tracks.length}
              </span>
            )}
            {track.title || `Track ${current + 1}`}
          </p>
        )}

        {story && !compact && (
          <p className="mx-auto mt-4 max-w-xl whitespace-pre-wrap text-center leading-relaxed text-muted">
            {story}
          </p>
        )}

        {/* 오디오 컨트롤 + 이전/다음 */}
        {track?.audioUrl ? (
          <div className="mt-5">
            <audio
              key={track.audioUrl}
              ref={audioRef}
              controls
              preload="none"
              src={track.audioUrl}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => {
                setPlaying(false);
                // 목록 순서대로 다음 곡(마지막이면 멈춤).
                if (!autoNext) return;
                const at = playable.indexOf(current);
                if (at >= 0 && at < playable.length - 1) goTo(playable[at + 1], true);
              }}
              className="mx-auto w-full max-w-md"
            >
              <track kind="captions" />
            </audio>
            {hasList && (
              <div className="mx-auto mt-2 flex max-w-md flex-wrap items-center justify-center gap-2">
                <button type="button" className={btn} onClick={() => step(-1)} disabled={playable.length < 2}>
                  ◀ 이전 곡
                </button>
                <button type="button" className={btn} onClick={() => step(1)} disabled={playable.length < 2}>
                  다음 곡 ▶
                </button>
                <label className="ml-1 flex items-center gap-1 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={autoNext}
                    onChange={(e) => setAutoNext(e.target.checked)}
                  />
                  순서대로 이어 듣기
                </label>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-muted">
            아직 등록된 음원이 없습니다.
          </p>
        )}

        {/* 곡 목록(순서 표시·순서 변경) */}
        {hasList && (
          <ol className="mx-auto mt-6 max-w-md divide-y divide-border rounded-xl border border-border">
            {effOrder.map((origIdx, k) => {
              const t = tracks[origIdx];
              if (!t) return null;
              const isCur = origIdx === current;
              return (
                <li key={origIdx} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => goTo(origIdx, true)}
                    disabled={!t.audioUrl}
                    className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                      isCur ? "bg-primary-soft text-primary" : "hover:bg-surface"
                    } ${t.audioUrl ? "" : "opacity-50"}`}
                  >
                    <span className="w-5 shrink-0 tabular-nums text-muted">{k + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {t.title || `Track ${origIdx + 1}`}
                    </span>
                    {isCur && playing && <span className="shrink-0 text-xs">▶</span>}
                  </button>
                  <span className="flex shrink-0 gap-0.5 pr-2">
                    <button
                      type="button"
                      aria-label="위로"
                      title="순서 위로"
                      onClick={() => move(origIdx, -1)}
                      disabled={k === 0}
                      className="rounded px-1.5 py-1 text-xs text-muted hover:bg-surface disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label="아래로"
                      title="순서 아래로"
                      onClick={() => move(origIdx, 1)}
                      disabled={k === effOrder.length - 1}
                      className="rounded px-1.5 py-1 text-xs text-muted hover:bg-surface disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* 선택 곡 가사 + 이야기 */}
        {(track?.lyrics || track?.story) && (
          <div className="mx-auto mt-8 max-w-xl space-y-6">
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
