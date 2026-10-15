"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { requestFreeReapplyAction } from "@/app/business/actions";
import type { FreeBlogStatus as Status } from "@/lib/freeAccess";

/**
 * 무료 플랜 블로그 이용권 안내 — 남은 횟수(하루/월)와 상태를 보여주고,
 * 기간이 끝났으면 '재신청'(관리자 승인) 버튼을 제공한다. 무료가 아니면 렌더 안 함.
 */
export function FreeBlogStatus({ status }: { status: Status }) {
  const ko = useLocale() === "ko";
  const [pending, setPending] = useState(status.pending);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!status.isFree) return null;

  const reapply = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await requestFreeReapplyAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      setPending(true);
      setMsg(
        ko
          ? "재신청이 접수됐어요. 관리자 승인 후 다시 글을 쓸 수 있어요."
          : "Re-apply submitted. You can write again after admin approval.",
      );
    } catch {
      setError(ko ? "잠시 후 다시 시도해주세요." : "Please try again later.");
    } finally {
      setBusy(false);
    }
  };

  const dailyLeft = Math.max(0, status.dailyLimit - status.usedDaily);
  const monthlyLeft = Math.max(0, status.monthlyLimit - status.usedMonthly);
  const periodText = status.periodEnd
    ? new Date(status.periodEnd).toLocaleDateString(ko ? "ko-KR" : "en-US")
    : null;

  // 상태별 박스 색
  const tone =
    pending || status.needsReapply
      ? "border-amber-300 bg-amber-50"
      : "border-border bg-surface";

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">
            {ko ? "무료 플랜 블로그" : "Free plan blog"}
          </span>
          <span className="ml-2 text-muted">
            {ko
              ? `오늘 ${dailyLeft}/${status.dailyLimit} · 이번 달 ${monthlyLeft}/${status.monthlyLimit} 남음`
              : `Today ${dailyLeft}/${status.dailyLimit} · This month ${monthlyLeft}/${status.monthlyLimit} left`}
          </span>
          {periodText && !status.needsReapply && !pending && (
            <span className="ml-2 text-xs text-muted">
              {ko ? `이용 만료 ${periodText}` : `Renews after ${periodText}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href="/pricing" variant="ghost" size="sm">
            {ko ? "업그레이드" : "Upgrade"}
          </ButtonLink>
          {status.needsReapply && !pending && (
            <Button size="sm" onClick={reapply} disabled={busy}>
              {busy ? <Spinner className="size-4" /> : null}
              {ko ? "재신청" : "Re-apply"}
            </Button>
          )}
          {pending && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              {ko ? "승인 대기 중" : "Pending approval"}
            </span>
          )}
        </div>
      </div>
      {status.needsReapply && !pending && !msg && (
        <p className="mt-2 text-xs text-amber-700">
          {ko
            ? "무료 이용 기간이 끝났어요. '재신청'을 누르면 관리자 승인 후 한 달 더 이용할 수 있어요."
            : "Your free month ended. Re-apply to get another month after admin approval."}
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-primary">{msg}</p>}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
