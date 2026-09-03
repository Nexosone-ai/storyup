"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GeneratingScreen } from "@/components/ai/GeneratingScreen";
import { useLocale } from "@/components/i18n/LocaleProvider";

const STEPS_KO = [
  "랜딩페이지 구조를 잡는 중...",
  "섹션 콘텐츠를 작성하는 중...",
  "브랜드 톤을 입히는 중...",
  "랜딩페이지를 완성하는 중...",
];

const STEPS_EN = [
  "Structuring your landing page...",
  "Writing section content...",
  "Applying your brand tone...",
  "Finishing your landing page...",
];

export function WebsiteGenerator({ businessId }: { businessId: string }) {
  const ko = useLocale() === "ko";
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
      if (!res.ok)
        throw new Error(
          json.error ?? (ko ? "생성에 실패했습니다." : "Generation failed."),
        );
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : ko
            ? "생성에 실패했습니다."
            : "Generation failed.",
      );
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
          ? "비즈니스 랜딩페이지를 만들고 있어요..."
          : "Building your business landing page..."
      }
      steps={ko ? STEPS_KO : STEPS_EN}
      error={error}
      onRetry={run}
    />
  );
}
