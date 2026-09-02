"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // 루트 에러 바운더리는 LocaleProvider 밖에서 렌더링되므로 쿠키로 직접 판별한다.
  const ko =
    typeof document === "undefined" || !document.cookie.includes("locale=en");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
      <div>
        <p className="text-2xl font-bold">
          {ko ? "문제가 발생했어요" : "Something went wrong"}
        </p>
        <p className="mt-2 text-muted">
          {ko
            ? "잠시 후 다시 시도해주세요. 계속되면 새로고침 해주세요."
            : "Please try again shortly. Refresh the page if it keeps happening."}
        </p>
      </div>
      <Button onClick={reset}>{ko ? "다시 시도" : "Try again"}</Button>
    </div>
  );
}
