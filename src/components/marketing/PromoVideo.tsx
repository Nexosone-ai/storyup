"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";

/**
 * 메인 최상단 홍보 영상 — 음소거 자동재생·반복. React SSR 은 `muted` 속성을 HTML 에 내보내지
 * 않아 자동재생이 막힐 수 있으므로 ref 로 직접 muted 를 켜고 play() 를 시도한다.
 * 소리 켜기 버튼으로 사용자가 직접 음소거를 해제할 수 있다.
 */
export function PromoVideo({
  src,
  poster,
  ko,
}: {
  src: string;
  poster?: string;
  ko: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, []);

  const toggleMute = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) v.play().catch(() => {});
  };

  return (
    <div className="relative aspect-video max-h-[86svh] w-full overflow-hidden bg-black">
      <video
        ref={ref}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label={ko ? "STORYUP 소개 영상" : "STORYUP intro video"}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={toggleMute}
        aria-pressed={!muted}
        className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-black/75 sm:bottom-6 sm:right-6 sm:text-sm"
      >
        {muted ? (
          <Icon.volumeX className="size-4" />
        ) : (
          <Icon.volume2 className="size-4" />
        )}
        {muted
          ? ko
            ? "소리 켜기"
            : "Unmute"
          : ko
            ? "소리 끄기"
            : "Mute"}
      </button>
    </div>
  );
}
