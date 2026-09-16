"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import {
  setCouponUsedAction,
  deleteCouponClaimAction,
} from "@/app/business/event-actions";
import type { UserCouponClaim } from "@/lib/events";

/**
 * 대시보드 '문의/쿠폰관리'의 쿠폰 탭 — 모든 비즈니스의 쿠폰 수령자를 한 곳에서 관리한다.
 * 사용처리/삭제는 수령 행의 business_id를 그대로 액션에 넘겨 RLS로 검증한다.
 * `?post=` 쿼리가 있으면 해당 글의 쿠폰만 보여준다(편집기·알림에서 진입).
 */
export function DashboardCouponsView({
  claims: initial,
  focusPostId,
  lang,
}: {
  claims: UserCouponClaim[];
  focusPostId: string | null;
  lang: "ko" | "en";
}) {
  const ko = lang === "ko";
  const [claims, setClaims] = useState(initial);
  const [pending, start] = useTransition();

  const visible = useMemo(
    () =>
      focusPostId ? claims.filter((c) => c.postId === focusPostId) : claims,
    [claims, focusPostId],
  );
  const focusTitle = focusPostId
    ? (claims.find((c) => c.postId === focusPostId)?.postTitle ?? "")
    : "";

  const usedCount = visible.filter((c) => c.used_at).length;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(ko ? "ko-KR" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const toggleUsed = (claim: UserCouponClaim) =>
    start(async () => {
      const nextUsed = !claim.used_at;
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claim.id
            ? { ...c, used_at: nextUsed ? new Date().toISOString() : null }
            : c,
        ),
      );
      const res = await setCouponUsedAction(
        claim.businessId,
        claim.id,
        nextUsed,
      );
      if (res.error)
        setClaims((prev) =>
          prev.map((c) =>
            c.id === claim.id ? { ...c, used_at: claim.used_at } : c,
          ),
        );
    });

  const remove = (claim: UserCouponClaim) =>
    start(async () => {
      if (
        !window.confirm(
          ko ? "이 수령 기록을 삭제할까요?" : "Delete this claim record?",
        )
      )
        return;
      const prev = claims;
      setClaims((cur) => cur.filter((c) => c.id !== claim.id));
      const res = await deleteCouponClaimAction(claim.businessId, claim.id);
      if (res.error) setClaims(prev);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">
          {ko
            ? "블로그 이벤트에서 발급된 쿠폰 수령자예요. 매장에서 이름·전화·코드로 확인하고 사용처리하세요."
            : "People who claimed coupons from your blog events. Verify by name, phone, or code, then mark used."}
        </p>
      </div>

      {focusPostId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
          <span className="text-muted">{ko ? "필터:" : "Filter:"}</span>
          <span className="font-medium">
            {focusTitle || (ko ? "선택한 글" : "Selected post")}
          </span>
          <Link
            href="/dashboard/inquiries/coupons"
            className="ml-auto text-xs font-medium text-primary hover:underline"
          >
            {ko ? "전체 보기" : "View all"}
          </Link>
        </div>
      )}

      {visible.length > 0 && (
        <div className="flex gap-4 text-sm">
          <span className="rounded-lg bg-surface px-3 py-1.5">
            {ko ? "총 수령" : "Claimed"}{" "}
            <b className="tnum">{visible.length}</b>
          </span>
          <span className="rounded-lg bg-surface px-3 py-1.5">
            {ko ? "사용 완료" : "Used"} <b className="tnum">{usedCount}</b>
          </span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
            <span className="text-lg">🎟</span>
          </div>
          <p className="mt-4 font-semibold">
            {ko ? "아직 발급된 쿠폰이 없어요" : "No coupons claimed yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            {ko
              ? "블로그 글 편집 화면의 '이벤트'에서 쿠폰을 켜면, 방문자가 받은 쿠폰이 여기 모여요."
              : "Turn on a coupon in a blog post's 'Event' section, and claims will appear here."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">{ko ? "이름" : "Name"}</th>
                <th className="px-4 py-3 font-medium">
                  {ko ? "전화번호" : "Phone"}
                </th>
                <th className="px-4 py-3 font-medium">{ko ? "코드" : "Code"}</th>
                {!focusPostId && (
                  <th className="px-4 py-3 font-medium">
                    {ko ? "혜택 · 글" : "Benefit · Post"}
                  </th>
                )}
                <th className="px-4 py-3 font-medium">
                  {ko ? "받은 날짜" : "Claimed"}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {ko ? "사용처리" : "Used"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((c) => (
                <tr
                  key={c.id}
                  className={c.used_at ? "bg-surface/60 text-muted" : ""}
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 tnum">{c.phone}</td>
                  <td className="px-4 py-3 font-mono font-semibold tracking-wider">
                    {c.code}
                  </td>
                  {!focusPostId && (
                    <td className="px-4 py-3">
                      <span className="block">{c.benefit}</span>
                      <span className="block text-xs text-muted">
                        {c.postTitle}
                        {c.businessName ? ` · ${c.businessName}` : ""}
                      </span>
                    </td>
                  )}
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
