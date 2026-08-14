"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GeneratingScreen } from "@/components/ai/GeneratingScreen";

const STEPS = [
  "홈페이지 구조를 잡는 중...",
  "섹션 콘텐츠를 작성하는 중...",
  "브랜드 톤을 입히는 중...",
  "홈페이지를 완성하는 중...",
];

export function WebsiteGenerator({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/ai/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "생성에 실패했습니다.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성에 실패했습니다.");
    }
  }, [businessId, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  return (
    <GeneratingScreen
      title="비즈니스 홈페이지를 만들고 있어요..."
      steps={STEPS}
      error={error}
      onRetry={run}
    />
  );
}
