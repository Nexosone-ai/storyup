"use client";

import { useState, useTransition } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  setCouponUsedAction,
  deleteCouponClaimAction,
} from "@/app/business/event-actions";
import type { CouponClaimRow } from "@/types/database";

/** 쿠폰 수령자 목록 + 사용처리 (매장에서 이름·전화·코드로 대조). */
export function CouponClaimsView({
  businessId,
  postId,
  benefit,
  initialClaims,
}: {
  businessId: string;
  postId: string;
  benefit: string | null;
  initialClaims: CouponClaimRow[];
}) {
  const ko = useLocale() === "ko";
  const [claims, setClaims] = useState(initialClaims);
  const [pending, start] = useTransition();

  const usedCount = claims.filter((c) => c.used_at).length;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(ko ? "ko-KR" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const toggleUsed = (claim: CouponClaimRow) =>
    start(async () => {
      const nextUsed = !claim.used_at;
      // 낙관적 반영
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claim.id
            ? { ...c, used_at: nextUsed ? new Date().toISOString() : null }
            : c,
        ),
      );
      const res = await setCouponUsedAction(businessId, claim.id, nextUsed);
      if (res.error) {
        // 실패 시 롤백
        setClaims((prev) =>
          prev.map((c) =>
            c.id === claim.id ? { ...c, used_at: claim.used_at } : c,
          ),
        );
      }
    });

  const remove = (claim: CouponClaimRow) =>
    start(async () => {
      if (
        !window.confirm(
          ko
            ? "이 수령 기록을 삭제할까요?"
            : "Delete this claim record?",
        )
      )
        return;
      const prev = claims;
      setClaims((cur) => cur.filter((c) => c.id !== claim.id));
      const res = await deleteCouponClaimAction(businessId, claim.id);
      if (res.error) setClaims(prev);
    });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {ko ? "쿠폰 수령자" : "Coupon claims"}
          </h1>
          {benefit && (
            <p className="mt-0.5 text-sm text-muted">🎟 {benefit}</p>
          )}
        </div>
        <ButtonLink
          href={`/business/${businessId}/blog/${postId}`}
          variant="ghost"
          size="sm"
        >
          <Icon.arrowLeft width={16} height={16} />
          {ko ? "글 편집으로" : "Back to editor"}
        </ButtonLink>
      </div>

      <div className="flex gap-4 text-sm">
        <span className="rounded-lg bg-surface px-3 py-1.5">
          {ko ? "총 수령" : "Claimed"}{" "}
          <b className="tnum">{claims.length}</b>
        </span>
        <span className="rounded-lg bg-surface px-3 py-1.5">
          {ko ? "사용 완료" : "Used"} <b className="tnum">{usedCount}</b>
        </span>
      </div>

      {claims.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
          {ko
            ? "아직 쿠폰을 받은 사람이 없어요."
            : "No one has claimed a coupon yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">{ko ? "이름" : "Name"}</th>
                <th className="px-4 py-3 font-medium">
                  {ko ? "전화번호" : "Phone"}
                </th>
                <th className="px-4 py-3 font-medium">{ko ? "코드" : "Code"}</th>
                <th className="px-4 py-3 font-medium">
                  {ko ? "받은 날짜" : "Claimed"}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {ko ? "사용처리" : "Used"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {claims.map((c) => (
                <tr
                  key={c.id}
                  className={c.used_at ? "bg-surface/60 text-muted" : ""}
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 tnum">{c.phone}</td>
                  <td className="px-4 py-3 font-mono font-semibold tracking-wider">
                    {c.code}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {fmt(c.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => toggleUsed(c)}
                        disabled={pending}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          c.used_at
                            ? "border-border text-muted hover:text-foreground"
                            : "border-primary/40 bg-primary-soft text-primary hover:bg-primary/10"
                        }`}
                      >
                        {c.used_at
                          ? ko
                            ? "사용됨 · 취소"
                            : "Used · undo"
                          : ko
                            ? "사용 완료"
                            : "Mark used"}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(c)}
                        disabled={pending}
                        aria-label={ko ? "삭제" : "Delete"}
                        className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-50"
                      >
                        <Icon.x width={15} height={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
