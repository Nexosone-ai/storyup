"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/track";

/** 공개 사이트 페이지 조회를 기록한다 (경로가 바뀔 때마다 1회). */
export function TrackPageView({ slug }: { slug: string }) {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent({ slug, event: "page_view", path: pathname });
  }, [slug, pathname]);

  return null;
}
