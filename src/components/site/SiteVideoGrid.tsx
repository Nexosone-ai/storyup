import type { SiteVideoItem } from "@/types/domain";

/**
 * 공개 사이트 영상 그리드 — 쇼츠(9:16)는 세로 카드, AI 영상(16:9)은 가로 카드.
 * 서버 렌더 가능한 순수 마크업(<video controls>). 랜딩 '영상' 블록과 /videos 페이지가 공유.
 */
export function SiteVideoGrid({
  videos,
  ko,
  compact = false,
}: {
  videos: SiteVideoItem[];
  ko: boolean;
  /** 랜딩 블록용 — 카드 간격·제목 크기를 줄인다. */
  compact?: boolean;
}) {
  if (videos.length === 0) return null;
  return (
    <div
      className={`grid ${compact ? "gap-4" : "gap-6"} sm:grid-cols-2 lg:grid-cols-3`}
    >
      {videos.map((v) => {
        const shorts = v.kind === "shorts";
        return (
          <figure
            key={v.id}
            className="overflow-hidden rounded-2xl border border-border bg-white"
          >
            <div
              className={`relative w-full bg-black ${shorts ? "aspect-[9/16] max-h-[520px]" : "aspect-video"}`}
            >
              <video
                src={v.url}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="min-w-0 truncate text-sm font-medium text-foreground">
                {v.title ||
                  (shorts ? (ko ? "쇼츠" : "Short") : ko ? "AI 영상" : "AI video")}
              </span>
              <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">
                {shorts ? (ko ? "쇼츠" : "Short") : ko ? "AI 영상" : "AI video"}
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
