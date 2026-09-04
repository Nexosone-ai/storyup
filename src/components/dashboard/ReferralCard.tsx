"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { claimInviteRewardAction } from "@/app/dashboard/growth/actions";

/**
 * 추천 카드 — 내 초대 링크 복사 + 초대 실적.
 * 최초 복사 1회에 한해 ref_invite 보상을 지급한다 (서버에서 멱등 처리).
 */
export function ReferralCard({
  code,
  invitedCount,
  inviteRewarded,
}: {
  code: string | null;
  invitedCount: number;
  inviteRewarded: boolean;
}) {
  const ko = useLocale() === "ko";
  const [copied, setCopied] = useState(false);
  const [rewarded, setRewarded] = useState(inviteRewarded);

  const link = code
    ? `${typeof window !== "undefined" ? window.location.origin : "https://www.storyup.me"}/join?ref=${code}`
    : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 미지원 */
    }
    if (!rewarded) {
      const res = await claimInviteRewardAction();
      if (res.granted) setRewarded(true);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold tracking-tight">
          {ko ? "친구 초대" : "Invite friends"}
        </h3>
        <span className="tnum text-sm text-muted">
          {ko ? `${invitedCount}명 초대 성공` : `${invitedCount} joined`}
        </span>
      </div>
      <p className="text-sm text-muted">
        {ko
          ? "친구가 내 링크로 가입하면 +300 UP, 유료 플랜으로 전환하면 +1,000 UP을 드려요."
          : "Earn +300 UP when a friend signs up with your link, and +1,000 UP when they upgrade."}
      </p>
      {code ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-surface-muted px-3 py-2 font-mono text-xs">
            {`storyup.me/join?ref=${code}`}
          </code>
          <Button size="sm" onClick={copy}>
            {copied
              ? ko
                ? "복사됨!"
                : "Copied!"
              : ko
                ? "링크 복사"
                : "Copy link"}
          </Button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          {ko
            ? "추천 코드를 준비 중입니다. 잠시 후 다시 확인해주세요."
            : "Preparing your referral code — check back shortly."}
        </p>
      )}
      {!rewarded && code && (
        <p className="text-xs text-primary">
          {ko
            ? "🎁 처음 링크를 복사하면 +100 UP!"
            : "🎁 Copy your link for the first time to earn +100 UP!"}
        </p>
      )}
      <p className="text-xs text-muted">
        {ko
          ? "직접 초대한 친구에 대해서만 보상이 지급됩니다 (자기 추천·중복 계정 제외)."
          : "Rewards apply to direct referrals only (no self-referrals or duplicate accounts)."}
      </p>
    </Card>
  );
}
