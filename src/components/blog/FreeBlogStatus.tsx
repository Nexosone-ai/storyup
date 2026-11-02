"use client";

import { ButtonLink } from "@/components/ui/Button";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { FreeBlogStatus as Status } from "@/lib/freeAccess";

/**
 * 무료 플랜 블로그 안내 — 오늘 남은 작성 횟수(하루 2개)를 보여준다.
 * 월 한도·재신청은 폐지됐다. 무료가 아니면 렌더하지 않는다.
 */
export function FreeBlogStatus({ status }: { status: Status }) {
  const ko = useLocale() === "ko";
  if (!status.isFree) return null;

  const dailyLeft = Math.max(0, status.dailyLimit - status.usedDaily);

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">
            {ko ? "무료 플랜 블로그" : "Free plan blog"}
          </span>
          <span className="ml-2 text-muted">
            {ko
              ? `오늘 ${dailyLeft}/${status.dailyLimit}개 남음`
              : `Today ${dailyLeft}/${status.dailyLimit} left`}
          </span>
        </div>
        <ButtonLink href="/pricing" variant="ghost" size="sm">
          {ko ? "업그레이드" : "Upgrade"}
        </ButtonLink>
      </div>
      <p className="mt-2 text-xs text-muted">
        {ko
          ? "무료 플랜은 하루 2개까지 글을 쓸 수 있어요(월 한도 없음)."
          : "Free plan: up to 2 posts per day (no monthly cap)."}
      </p>
    </div>
  );
}
