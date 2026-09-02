"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { GeneratingScreen } from "./GeneratingScreen";

export function BrandGenerator({ businessId }: { businessId: string }) {
  const router = useRouter();
  const ko = useLocale() === "ko";
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const steps = ko
    ? [
        "이야기를 이해하는 중...",
        "브랜드 목소리를 찾는 중...",
        "스토리를 쓰는 중...",
        "브랜드를 완성하는 중...",
      ]
    : [
        "Understanding your story...",
        "Finding your brand voice...",
        "Writing the story...",
        "Finishing your brand...",
      ];

  const run = useCallback(async () => {
    setError(null);
    const failMsg = ko ? "생성에 실패했습니다." : "Generation failed.";
    try {
      const res = await fetch("/api/ai/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? failMsg);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : failMsg);
    }
  }, [businessId, router, ko]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  return (
    <GeneratingScreen
      title={
        ko
          ? "당신의 이야기를 브랜드로 만들고 있어요..."
          : "Turning your story into a brand..."
      }
      steps={steps}
      error={error}
      onRetry={run}
    />
  );
}
