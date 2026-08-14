"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GeneratingScreen } from "./GeneratingScreen";

const STEPS = [
  "이야기를 이해하는 중...",
  "브랜드 목소리를 찾는 중...",
  "스토리를 쓰는 중...",
  "브랜드를 완성하는 중...",
];

export function BrandGenerator({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/ai/brand", {
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
      title="당신의 이야기를 브랜드로 만들고 있어요..."
      steps={STEPS}
      error={error}
      onRetry={run}
    />
  );
}
