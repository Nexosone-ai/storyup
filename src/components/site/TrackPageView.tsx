"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/track";

/** 공개 사이트 페이지 조회를 기록한다 (경로가 바뀔 때마다 1회). */
export function TrackPageView({ slug }: { slug: string }) {
  const pathname = usePathname();

  useEffect(() => {
    // 쇼케이스 미리보기(iframe) 안에서 열린 경우는 조회수로 집계하지 않는다.
    if (window.top !== window.self) return;
    trackEvent({ slug, event: "page_view", path: pathname });
  }, [slug, pathname]);

  return null;
}
