import Link from "next/link";
import { cn } from "@/utils/cn";

/** 브랜드 로고 — 아이콘(로고 원본 크롭) + 워드마크(STORY 네이비 / UP 그라데이션) */
export function Logo({
  href = "/",
  className,
  dark = false,
}: {
  href?: string;
  className?: string;
  /** 네이비 등 어두운 배경 위에서 사용할 때 */
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-1", className)}
    >
      {/* 투명 배경 심볼 — 어느 배경 위에서도 상자 없이 표시 */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 정적 로고 에셋 */}
      <img
        src="/images/logo-icon.png"
        alt=""
        className="size-8 shrink-0 object-contain"
      />
      <span
        className={cn(
          "text-[19px] font-extrabold tracking-tight",
          dark ? "text-white" : "text-foreground",
        )}
      >
        STORY
        <span className="brand-gradient-text">UP</span>
      </span>
      {/* 베타 표시 — 정식 오픈 시 제거. 좁은 화면에선 숨겨 헤더 폭 확보 */}
      <span
        className={cn(
          "ml-1 hidden rounded-full border px-1.5 py-px text-[10px] font-bold uppercase tracking-wide sm:inline-block",
          dark
            ? "border-white/40 text-white/80"
            : "border-primary/40 text-primary",
        )}
      >
        Beta
      </span>
    </Link>
  );
}
