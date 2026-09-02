"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icons";
import { trackEvent } from "@/lib/track";
import { cn } from "@/utils/cn";

/**
 * X·Facebook·링크 복사 공유 버튼 묶음.
 * path는 사이트 내 상대 경로 (예: /site/cafe/blog/opening) — 절대 URL은
 * 클라이언트의 origin으로 만든다. slug가 있으면 공유 이벤트도 기록한다.
 */
export function ShareBar({
  path,
  title,
  slug,
  className,
  compact = false,
}: {
  path: string;
  title: string;
  slug?: string;
  className?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  // 글 제목의 언어에 맞춰 버튼 문구를 고른다 (사이트 콘텐츠 언어 추정)
  const ko = /[가-힣]/.test(title);

  const absUrl = () =>
    typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  const track = (channel: string) => {
    if (slug) trackEvent({ slug, event: "share", path, channel });
  };

  const shareX = () => {
    track("x");
    const u = new URL("https://twitter.com/intent/tweet");
    u.searchParams.set("url", absUrl());
    u.searchParams.set("text", title);
    window.open(u.toString(), "_blank", "noopener,width=600,height=500");
  };

  const shareFacebook = () => {
    track("facebook");
    const u = new URL("https://www.facebook.com/sharer/sharer.php");
    u.searchParams.set("u", absUrl());
    window.open(u.toString(), "_blank", "noopener,width=600,height=500");
  };

  const copyLink = async () => {
    track("link");
    try {
      await navigator.clipboard.writeText(absUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard 미지원 환경은 조용히 무시
    }
  };

  const btn = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-border text-muted transition-colors hover:border-primary/50 hover:text-primary",
    compact ? "size-9" : "px-4 py-2 text-sm font-medium",
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        onClick={shareX}
        className={btn}
        aria-label={ko ? "X에 공유" : "Share on X"}
      >
        <Icon.xBrand width={16} height={16} />
        {!compact && (ko ? "공유" : "Share")}
      </button>
      <button
        type="button"
        onClick={shareFacebook}
        className={btn}
        aria-label={ko ? "Facebook에 공유" : "Share on Facebook"}
      >
        <Icon.facebookBrand width={17} height={17} />
        {!compact && (ko ? "공유" : "Share")}
      </button>
      <button
        type="button"
        onClick={copyLink}
        className={btn}
        aria-label={ko ? "링크 복사" : "Copy link"}
      >
        {copied ? (
          <Icon.check width={16} height={16} />
        ) : (
          <Icon.link width={16} height={16} />
        )}
        {!compact &&
          (copied ? (ko ? "복사됨" : "Copied") : ko ? "링크 복사" : "Copy link")}
      </button>
    </div>
  );
}
