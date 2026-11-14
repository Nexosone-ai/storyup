"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  revokeShareAction,
  revokePartnerLinkAction,
  acceptShareAction,
  declineShareAction,
} from "@/app/dashboard/share/actions";
import type { OwnerShareRow, IncomingShareRow, SharedAccount } from "@/lib/accountShare";

const STATUS_LABEL: Record<string, string> = {
  pending: "수락 대기",
  accepted: "접근중",
  revoked: "해제됨",
};

export interface AvailablePartner {
  slug: string;
  displayName: string;
  intro: string | null;
  contact: string | null;
}

export function AccountShareView({
  ownerShares,
  incoming,
  sharedAccounts,
  availablePartners,
  canRevoke = true,
}: {
  ownerShares: OwnerShareRow[];
  incoming: IncomingShareRow[];
  sharedAccounts: SharedAccount[];
  /** 연결 가능한 파트너(공개 소개를 연 파트너, 이미 담당 중인 파트너 제외). */
  availablePartners: AvailablePartner[];
  /** 접근 해제는 계정 소유자 본인만(직원 계정은 보기만). */
  canRevoke?: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) => {
    setMsg(null);
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        setMsg(res.message ?? null);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">담당 파트너</h1>
        <p className="mt-1.5 text-sm text-muted">
          파트너(대행사)가 내 이메일을 고객으로 등록하면 여기에 표시되고, 파트너는 자기 계정으로
          로그인해 내 사업장의 콘텐츠를 대신 운영해요. (결제·구독 등 계정 설정은 공유되지 않아요.)
          원치 않으면 언제든 접근을 해제할 수 있어요.
        </p>
      </div>

      {msg && <p className="text-sm text-primary">{msg}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {/* 소유자: 나를 담당하는 파트너 (파트너가 등록 → 여기서 해제 가능) */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 font-semibold">나를 담당하는 파트너</p>
        {ownerShares.length === 0 && (
          <p className="text-sm text-muted">
            아직 담당 파트너가 없어요. 아래 파트너 중 한 곳에 상담을 요청하고, 파트너가 내 계정
            이메일을 등록하면 여기에 표시됩니다.
          </p>
        )}

        {ownerShares.length > 0 && (
          <ul className="divide-y divide-border">
            {ownerShares.map((s) => {
              const title =
                s.storefront?.displayName || s.partnerName || s.partnerEmail || "파트너";
              const sub = [s.storefront ? s.partnerName : null, s.partnerEmail]
                .filter((v) => v && v !== title)
                .join(" · ");
              return (
                <li key={s.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium">{title}</span>
                      <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </p>
                    {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
                    {s.storefront?.intro && (
                      <p className="mt-1 whitespace-pre-line text-xs text-muted">
                        {s.storefront.intro}
                      </p>
                    )}
                    {s.storefront?.contact && (
                      <p className="mt-1 text-xs">연락처: {s.storefront.contact}</p>
                    )}
                    {s.storefront && (
                      <Link
                        href={`/partners/${s.storefront.slug}`}
                        className="mt-1 inline-block text-xs font-medium text-primary underline underline-offset-2"
                      >
                        파트너 소개 보기 →
                      </Link>
                    )}
                  </div>
                  {canRevoke && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          s.status === "accepted" &&
                          !window.confirm(
                            `${title}의 내 사업장 접근을 해제할까요? 해제하면 파트너가 더 이상 대신 운영할 수 없어요.`,
                          )
                        )
                          return;
                        run(() =>
                          s.source === "link" && s.partnerUserId
                            ? revokePartnerLinkAction(s.partnerUserId)
                            : revokeShareAction(s.id),
                        );
                      }}
                      disabled={busy}
                      className="shrink-0 text-xs text-danger hover:underline disabled:opacity-50"
                    >
                      {s.status === "accepted" ? "접근 해제" : "취소"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 연결 가능한 파트너 — 공개 소개를 연 파트너 목록(이미 담당 중인 파트너 제외). */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-semibold">연결 가능한 파트너</p>
          {availablePartners.length > 0 && (
            <span className="text-xs text-muted">{availablePartners.length}곳</span>
          )}
        </div>
        {availablePartners.length === 0 ? (
          <p className="text-sm text-muted">지금 안내할 수 있는 다른 파트너가 없어요.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted">
              소개 페이지에서 서비스와 연락처를 확인하고 상담을 요청하세요. 파트너가 내 계정
              이메일을 등록하면 담당 파트너로 연결돼요.
            </p>
            <ul className="space-y-2">
              {availablePartners.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/partners/${p.slug}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:border-primary/50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{p.displayName}</span>
                      {p.intro && (
                        <span className="mt-0.5 block whitespace-pre-line text-xs text-muted">
                          {p.intro}
                        </span>
                      )}
                      {p.contact && (
                        <span className="mt-0.5 block text-xs">연락처: {p.contact}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-primary">소개 보기 →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <Link
          href="/dashboard/supporters"
          className="mt-3 inline-block text-xs font-medium text-primary underline underline-offset-2"
        >
          분야별 전문가(서포터즈)에게 의뢰하기 →
        </Link>
      </section>

      {/* 파트너: 들어온 초대 */}
      {incoming.length > 0 && (
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="mb-2 font-semibold">들어온 공유 초대</p>
          <ul className="divide-y divide-border">
            {incoming.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <b>{inv.ownerName || inv.ownerEmail || "계정"}</b> 님이 계정을 공유했어요.
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => run(() => acceptShareAction(inv.id))} disabled={busy}>
                    수락
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(() => declineShareAction(inv.id))}
                    disabled={busy}
                  >
                    거절
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 파트너: 접근 중인 계정 */}
      {sharedAccounts.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-2 font-semibold">접근 중인 계정</p>
          <ul className="space-y-3">
            {sharedAccounts.map((acc) => (
              <li key={acc.ownerUserId}>
                <p className="text-sm font-medium">{acc.ownerName || "공유 계정"}</p>
                {acc.businesses.length > 0 ? (
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {acc.businesses.map((b) => (
                      <li key={b.id}>
                        <Link
                          href={`/business/${b.id}`}
                          className="rounded-lg border border-border px-3 py-1.5 text-sm text-primary hover:border-primary/60"
                        >
                          {b.name || "사업장"} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted">아직 사업장이 없어요.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
