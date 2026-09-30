/**
 * 공개 사이트(랜딩·블로그) 하단 우측에 표시되는 "Made with STORYUP" 워터마크.
 * Free 플랜에서만 노출되고, Basic 이상(plan.watermarkRemoved)에서는 제거된다.
 * 방문자 클릭 시 STORYUP 소개로 이동(유입 채널 추적용 utm 포함).
 */
export function StoryupWatermark() {
  return (
    <a
      href="https://www.storyup.me/?utm_source=watermark&utm_medium=site"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Made with STORYUP"
      className="fixed bottom-3 right-3 z-50 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/90 px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-md backdrop-blur transition-colors hover:bg-white hover:text-neutral-900"
    >
      <span className="text-neutral-500">Made with</span>
      <span className="tracking-tight text-neutral-900">
        STORY
        <span className="bg-gradient-to-r from-[#e8703a] to-[#f4a259] bg-clip-text text-transparent">
          UP
        </span>
      </span>
    </a>
  );
}
