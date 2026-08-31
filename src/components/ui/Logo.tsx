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
      className={cn("inline-flex items-center gap-2", className)}
    >
      {/* 푸터 칩과 동일한 배지 스타일 아이콘 */}
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg bg-white",
          !dark && "border border-border shadow-xs",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 로고 에셋 */}
        <img
          src="/images/logo-icon.png"
          alt=""
          className="size-6 object-contain"
        />
      </span>
      <span
        className={cn(
          "text-[19px] font-extrabold tracking-tight",
          dark ? "text-white" : "text-foreground",
        )}
      >
        STORY
        <span className="brand-gradient-text">UP</span>
      </span>
    </Link>
  );
}
