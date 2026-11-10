"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

/**
 * 파트너 영업 링크 2종 — 같은 추천코드에 유형만 다르다.
 *  · 고객용        /join?ref=코드             → 가입자가 내 고객(대행)으로 자동 연결
 *  · 영업파트너 모집 /join?ref=코드&as=partner  → 가입자가 파트너(영업)으로 등록
 * 파트너(영업)이 모집한 영업파트너는 깊이 제한(2단계) 때문에 상위파트너 아래에 등록된다.
 */
export function PartnerReferralLink({
  code,
  siteUrl,
  isSub,
  ko,
}: {
  code: string | null;
  siteUrl: string;
  isSub: boolean;
  ko: boolean;
}) {
  const clientLink = code ? `${siteUrl}/join?ref=${code}` : "";
  const partnerLink = code ? `${siteUrl}/join?ref=${code}&as=partner` : "";

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Icon.link className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">
          {ko ? "내 영업 링크" : "My sales links"}
        </h2>
        {code && (
          <span className="text-xs text-muted">
            {ko ? "추천 코드" : "Code"} <b>{code}</b>
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        {ko
          ? "가입시킬 사람의 유형에 맞는 링크를 보내세요. 가입 즉시 자동으로 등록됩니다."
          : "Send the link that matches who you are signing up. They are registered automatically on sign-up."}
      </p>
      {code ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <LinkBox
            title={ko ? "고객(가맹점) 가입" : "Client sign-up"}
            desc={
              ko
                ? "이 링크로 가입한 사람은 내 고객으로 연결돼 대행·판매 대상이 됩니다."
                : "Sign-ups through this link become your clients."
            }
            link={clientLink}
            ko={ko}
          />
          <LinkBox
            title={ko ? "영업파트너 모집" : "Recruit a sales partner"}
            desc={
              ko
                ? isSub
                  ? "이 링크로 가입한 사람은 파트너(영업)으로 등록됩니다(2단계 제한으로 상위파트너 아래, 리크루터는 나로 기록)."
                  : "이 링크로 가입한 사람은 내 아래 파트너(영업)으로 등록됩니다."
                : isSub
                  ? "Sign-ups become sales partners under your parent partner (2-level limit), recorded as recruited by you."
                  : "Sign-ups become sales partners under you."
            }
            link={partnerLink}
            ko={ko}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">
          {ko
            ? "추천 코드를 준비 중입니다. 잠시 후 새로고침 해주세요."
            : "Preparing your code. Please refresh shortly."}
        </p>
      )}
      {!isSub && (
        <p className="mt-3 text-xs text-muted">
          {ko ? "이미 가입한 사람은 " : "For someone who already has an account, use "}
          <Link href="/partner/sub-partners" className="font-medium text-primary hover:underline">
            {ko ? "파트너(영업) 관리" : "Sales partners"}
          </Link>
          {ko ? "에서 이메일로 바로 등록할 수 있어요." : " to register them by email."}
        </p>
      )}
    </Card>
  );
}

function LinkBox({
  title,
  desc,
  link,
  ko,
}: {
  title: string;
  desc: string;
  link: string;
  ko: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 권한 없음 — 사용자가 직접 복사 */
    }
  };
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted">{desc}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="max-w-full truncate rounded-md bg-surface px-2 py-1 text-xs">{link}</code>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? (ko ? "복사됨" : "Copied") : ko ? "복사" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
