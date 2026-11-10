"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

/**
 * 파트너 영업 링크 — 추천코드(?ref=)로 가입한 고객은 자동으로 이 파트너의 고객으로 연결된다.
 * (구 마케터/유통망의 '내 추천 링크'를 파트너로 통합.)
 */
export function PartnerReferralLink({
  code,
  siteUrl,
  canManageSubs,
  ko,
}: {
  code: string | null;
  siteUrl: string;
  canManageSubs: boolean;
  ko: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const link = code ? `${siteUrl}/?ref=${code}` : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 권한 없음 — 사용자가 직접 복사 */
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Icon.link className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">
          {ko ? "내 영업 링크" : "My sales link"}
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        {ko
          ? "이 링크로 가입한 고객(가맹점)은 자동으로 내 고객에 연결됩니다."
          : "Anyone who signs up through this link is linked to you as a client automatically."}
        {canManageSubs && (
          <>
            {" "}
            {ko ? "영업자(서브파트너) 등록은 " : "To recruit a sub-partner, use "}
            <Link href="/partner/sub-partners" className="font-medium text-primary hover:underline">
              {ko ? "서브파트너 관리" : "Sub-partners"}
            </Link>
            {ko ? "에서 하세요." : "."}
          </>
        )}
      </p>
      {code ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-surface-2 px-2 py-1 text-xs">{link}</code>
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? (ko ? "복사됨" : "Copied") : ko ? "링크 복사" : "Copy link"}
          </Button>
          <span className="text-xs text-muted">
            {ko ? "추천 코드" : "Code"} <b>{code}</b>
          </span>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">
          {ko
            ? "추천 코드를 준비 중입니다. 잠시 후 새로고침 해주세요."
            : "Preparing your code. Please refresh shortly."}
        </p>
      )}
    </Card>
  );
}
