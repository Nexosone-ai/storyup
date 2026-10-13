"use client";

import { useEffect } from "react";

/** 광고 노출 비콘 — top-window에서만 1회 전송(프리뷰/iframe 제외). */
export function AdImpressionBeacon({ placementId }: { placementId: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.top !== window.self) return; // iframe/preview 제외
    const body = JSON.stringify({ placementId });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/ads/impression",
          new Blob([body], { type: "application/json" }),
        );
      } else {
        void fetch("/api/ads/impression", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } catch {
      /* ignore */
    }
  }, [placementId]);
  return null;
}
