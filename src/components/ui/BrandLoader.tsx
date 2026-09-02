/** 로딩 상태에 표시하는 STORYUP 심볼 — 페이지 전환·데이터 로딩용. */
export function BrandLoader({ label }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-4">
        <span className="relative grid size-14 place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- 정적 로고 에셋 */}
          <img
            src="/images/logo-symbol.png"
            alt=""
            className="size-11 animate-pulse object-contain"
          />
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
        </span>
        {label && <p className="text-sm text-muted">{label}</p>}
      </div>
    </div>
  );
}
