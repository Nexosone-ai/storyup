import Link from "next/link";
import type { SiteBanner, SiteBannerAspect } from "@/types/domain";

const ASPECT_CLASS: Record<SiteBannerAspect, string> = {
  "4:1": "aspect-[4/1]",
  "3:1": "aspect-[3/1]",
  "16:9": "aspect-[16/9]",
  "1:1": "aspect-square",
};

/**
 * 배너 공개 렌더러 — 배경 이미지 위에 문구(제목·소제목)와 버튼을 오버레이.
 * 높이(heightPx)가 있으면 그 높이로, 없으면 비율 프리셋으로 표시한다.
 * ctaHref가 있으면 배너 전체가 링크가 된다. 서버/클라이언트 공용(정적).
 */
export function BannerView({
  banner,
  className,
}: {
  banner: SiteBanner;
  className?: string;
}) {
  const hasText = !!(banner.title || banner.subtitle || banner.ctaLabel);
  const useHeight = !!banner.heightPx && banner.heightPx > 0;
  const style = useHeight ? { height: `${banner.heightPx}px` } : undefined;
  const ratioClass = useHeight
    ? ""
    : (ASPECT_CLASS[banner.aspect ?? "3:1"] ?? "aspect-[3/1]");

  const inner = (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-border bg-primary-soft ${ratioClass} ${className ?? ""}`}
      style={style}
    >
      {banner.image && (
        // eslint-disable-next-line @next/next/no-img-element -- 원격 스토리지 URL, 컨테이너 꽉 채움
        <img
          src={banner.image}
          alt={banner.title ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {hasText && <div className="absolute inset-0 bg-black/35" />}
      {hasText && (
        <div className="relative flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white">
          {banner.title && (
            <p className="text-balance text-xl font-bold leading-tight sm:text-3xl">
              {banner.title}
            </p>
          )}
          {banner.subtitle && (
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-white/90 sm:text-base">
              {banner.subtitle}
            </p>
          )}
          {banner.ctaLabel && (
            <span className="mt-2 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-foreground">
              {banner.ctaLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );

  const href = banner.ctaHref?.trim();
  if (href) {
    if (/^https?:\/\//i.test(href)) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

/** 특정 위치(placement)의 배너들을 컨테이너에 모아 렌더. 없으면 null. */
export function BannerStrip({
  banners,
  placement,
  className,
}: {
  banners: SiteBanner[] | undefined;
  placement: SiteBanner["placement"];
  className?: string;
}) {
  const list = (banners ?? []).filter((b) => b.placement === placement);
  if (list.length === 0) return null;
  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {list.map((b) => (
        <BannerView key={b.id} banner={b} />
      ))}
    </div>
  );
}
