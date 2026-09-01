// 클라이언트 전용 이벤트 트래킹 헬퍼 — 실패해도 조용히 무시한다.

export interface TrackInput {
  slug: string;
  event: "page_view" | "share";
  path?: string;
  channel?: string;
}

export function trackEvent(input: TrackInput) {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      ...input,
      referrer: document.referrer || undefined,
    });
    const blob = new Blob([payload], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/track", blob)) {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    // 트래킹 실패는 사용자 경험에 영향을 주지 않는다.
  }
}
