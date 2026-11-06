"use client";

import { useEffect, useRef, useState } from "react";
import { createMusicBed, type ShortsMood } from "@/lib/shorts/music";

const PREVIEW_SEC = 12;

/**
 * 배경 음악 미리듣기 버튼.
 * - trackUrl(라이브러리 음원)이 있으면 HTMLAudio 로 재생.
 * - 아니면 mood(합성 음악)를 WebAudio 로 12초 동안 스피커에 바로 합성한다(패킷·전송 없음).
 * 선택이 바뀌거나 언마운트되면 자동으로 멈춘다.
 */
export function BgmPreview({
  mood,
  trackUrl,
  disabled,
  ko = true,
}: {
  mood?: ShortsMood;
  trackUrl?: string | null;
  disabled?: boolean;
  ko?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const bedRef = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    bedRef.current?.stop();
    bedRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx) void ctx.close().catch(() => undefined);
    setPlaying(false);
  };

  // 선택이 바뀌면(혹은 언마운트) 재생 중인 것을 멈춘다.
  useEffect(() => stop, [mood, trackUrl]);

  const canPlay = !!trackUrl || (!!mood && mood !== "none");
  if (!canPlay) return null;

  const play = async () => {
    stop();
    try {
      if (trackUrl) {
        const a = new Audio(trackUrl);
        a.volume = 0.9;
        a.onended = stop;
        audioRef.current = a;
        await a.play();
      } else if (mood && mood !== "none") {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new Ctor();
        ctxRef.current = ctx;
        if (ctx.state !== "running") await ctx.resume();
        const bed = createMusicBed(
          ctx,
          mood,
          PREVIEW_SEC,
          0.5,
          1.5,
          ctx.destination,
        );
        bedRef.current = bed;
        bed.start();
        timerRef.current = window.setTimeout(stop, PREVIEW_SEC * 1000 + 200);
      }
      setPlaying(true);
    } catch {
      stop();
    }
  };

  return (
    <button
      type="button"
      onClick={playing ? stop : play}
      disabled={disabled}
      aria-pressed={playing}
      className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        playing
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted hover:border-primary hover:text-primary"
      }`}
      title={
        ko ? "선택한 배경 음악을 들어봅니다" : "Preview the selected music"
      }
    >
      {playing ? (
        <>
          <span aria-hidden>■</span> {ko ? "멈춤" : "Stop"}
        </>
      ) : (
        <>
          <span aria-hidden>▶</span> {ko ? "들어보기" : "Preview"}
        </>
      )}
    </button>
  );
}
