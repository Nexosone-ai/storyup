"use client";

import { useEffect, useState } from "react";
import { formatDate, timeAgo } from "@/lib/datetime";

/**
 * 유튜브식 상대시간 표시. 서버/최초 렌더에서는 절대 날짜를 보여주고(하이드레이션
 * 불일치 방지), 마운트 후 뷰어의 시계 기준 "N시간 전"으로 바꾼다. 1분마다 갱신.
 * 마우스를 올리면(title) 정확한 날짜가 보인다.
 */
export function RelativeTime({
  iso,
  ko,
  className,
}: {
  iso: string;
  ko: boolean;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // 마운트 후 뷰어의 시계로 갱신하고 1분마다 이어서 갱신한다.
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const label = now === null ? formatDate(iso, ko) : timeAgo(iso, ko, now);
  return (
    <time
      dateTime={iso}
      title={formatDate(iso, ko)}
      className={className}
      suppressHydrationWarning
    >
      {label}
    </time>
  );
}
