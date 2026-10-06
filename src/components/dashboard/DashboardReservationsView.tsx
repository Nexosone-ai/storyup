"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import {
  setReservationStatusAction,
  deleteReservationAction,
} from "@/app/business/event-actions";
import type { UserReservation, ReservationStatus } from "@/lib/events";

/**
 * 대시보드 '문의/쿠폰관리'의 예약 탭 — 모든 비즈니스의 예약 요청을 한 곳에서 관리한다.
 * 승인 방식은 '사장님 확정': 손님 요청은 대기(pending)로 들어오고, 여기서 확정/취소한다.
 * 상태변경·삭제는 예약 행의 business_id를 그대로 액션에 넘겨 RLS로 검증한다.
 * `?post=` 쿼리가 있으면 해당 글의 예약만 보여준다(편집기·알림에서 진입).
 */
export function DashboardReservationsView({
  reservations: initial,
  focusPostId,
  lang,
}: {
  reservations: UserReservation[];
  focusPostId: string | null;
  lang: "ko" | "en";
}) {
  const ko = lang === "ko";
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<"all" | ReservationStatus>("all");
  const [pending, start] = useTransition();

  const scoped = useMemo(
    () =>
      focusPostId ? rows.filter((r) => r.postId === focusPostId) : rows,
    [rows, focusPostId],
  );
  const visible = useMemo(
    () => (filter === "all" ? scoped : scoped.filter((r) => r.status === filter)),
    [scoped, filter],
  );
  const focusTitle = focusPostId
    ? (rows.find((r) => r.postId === focusPostId)?.postTitle ?? "")
    : "";

  const pendingCount = scoped.filter((r) => r.status === "pending").length;
  const confirmedCount = scoped.filter((r) => r.status === "confirmed").length;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(ko ? "ko-KR" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const fmtWhen = (r: UserReservation) => {
    if (!r.desiredDate && !r.desiredTime) return ko ? "미지정" : "—";
    const d = r.desiredDate
      ? new Date(`${r.desiredDate}T00:00:00`).toLocaleDateString(
          ko ? "ko-KR" : "en-US",
          { month: "short", day: "numeric", weekday: "short" },
        )
      : "";
    return [d, r.desiredTime].filter(Boolean).join(" ");
  };

  const setStatus = (r: UserReservation, status: ReservationStatus) =>
    start(async () => {
      const prev = rows;
      setRows((cur) =>
        cur.map((x) => (x.id === r.id ? { ...x, status } : x)),
      );
      const res = await setReservationStatusAction(r.businessId, r.id, status);
      if (res.error) setRows(prev);
    });

  const remove = (r: UserReservation) =>
    start(async () => {
      if (
        !window.confirm(
          ko ? "이 예약 기록을 삭제할까요?" : "Delete this reservation?",
        )
      )
        return;
      const prev = rows;
      setRows((cur) => cur.filter((x) => x.id !== r.id));
      const res = await deleteReservationAction(r.businessId, r.id);
      if (res.error) setRows(prev);
    });

  const statusBadge = (status: ReservationStatus) => {
    const map: Record<ReservationStatus, { label: string; cls: string }> = {
      pending: {
        label: ko ? "대기" : "Pending",
        cls: "bg-amber-50 text-warning border-amber-200",
      },
      confirmed: {
        label: ko ? "확정" : "Confirmed",
        cls: "bg-primary-soft text-primary border-primary/30",
      },
      cancelled: {
        label: ko ? "취소" : "Cancelled",
        cls: "bg-surface-muted text-muted border-border",
      },
    };
    const s = map[status];
    return (
      <span
        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}
      >
        {s.label}
      </span>
    );
  };

  const filters: { key: "all" | ReservationStatus; label: string }[] = [
    { key: "all", label: ko ? "전체" : "All" },
    { key: "pending", label: ko ? "대기" : "Pending" },
    { key: "confirmed", label: ko ? "확정" : "Confirmed" },
    { key: "cancelled", label: ko ? "취소" : "Cancelled" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">
          {ko
            ? "블로그 이벤트에서 들어온 예약 요청이에요. 확정하면 상태가 바뀌고, 남겨주신 연락처로 직접 연락해 확정하세요."
            : "Reservation requests from your blog events. Confirm a request, then contact the guest at the number they left."}
        </p>
      </div>

      {focusPostId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
          <span className="text-muted">{ko ? "필터:" : "Filter:"}</span>
          <span className="font-medium">
            {focusTitle || (ko ? "선택한 글" : "Selected post")}
          </span>
          <Link
            href="/dashboard/inquiries/reservations"
            className="ml-auto text-xs font-medium text-primary hover:underline"
          >
            {ko ? "전체 보기" : "View all"}
          </Link>
        </div>
      )}

      {scoped.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-4 text-sm">
            <span className="rounded-lg bg-surface px-3 py-1.5">
              {ko ? "총 예약" : "Total"}{" "}
              <b className="tnum">{scoped.length}</b>
            </span>
            <span className="rounded-lg bg-surface px-3 py-1.5">
              {ko ? "대기" : "Pending"} <b className="tnum">{pendingCount}</b>
            </span>
            <span className="rounded-lg bg-surface px-3 py-1.5">
              {ko ? "확정" : "Confirmed"}{" "}
              <b className="tnum">{confirmedCount}</b>
            </span>
          </div>
          <div className="ml-auto inline-flex gap-1 rounded-xl border border-border bg-surface p-1">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
            <span className="text-lg">📅</span>
          </div>
          <p className="mt-4 font-semibold">
            {scoped.length === 0
              ? ko
                ? "아직 예약 요청이 없어요"
                : "No reservations yet"
              : ko
                ? "해당 상태의 예약이 없어요"
                : "No reservations in this status"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            {ko
              ? "블로그 글 편집 화면의 '이벤트'에서 '예약 받기'를 켜면, 방문자가 남긴 예약이 여기 모여요."
              : "Turn on 'Reservations' in a blog post's 'Event' section, and requests will appear here."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">{ko ? "상태" : "Status"}</th>
                <th className="px-4 py-3 font-medium">{ko ? "이름" : "Name"}</th>
                <th className="px-4 py-3 font-medium">
                  {ko ? "전화번호" : "Phone"}
                </th>
                <th className="px-4 py-3 font-medium">
                  {ko ? "희망 일시" : "When"}
                </th>
                <th className="px-4 py-3 font-medium">{ko ? "인원" : "Party"}</th>
                <th className="px-4 py-3 font-medium">
                  {ko ? "요청사항 · 글" : "Note · Post"}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {ko ? "처리" : "Actions"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className={r.status === "cancelled" ? "text-muted" : ""}
                >
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 tnum">{r.phone}</td>
                  <td className="px-4 py-3">{fmtWhen(r)}</td>
                  <td className="px-4 py-3 tnum">
                    {r.partySize ? (ko ? `${r.partySize}명` : r.partySize) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.note && <span className="block">{r.note}</span>}
                    <span className="block text-xs text-muted">
                      {r.postTitle}
                      {r.businessName ? ` · ${r.businessName}` : ""}
                      <span className="ml-1">· {fmt(r.created_at)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {r.status !== "confirmed" && (
                        <button
                          type="button"
                          onClick={() => setStatus(r, "confirmed")}
                          disabled={pending}
                          className="rounded-lg border border-primary/40 bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {ko ? "확정" : "Confirm"}
                        </button>
                      )}
                      {r.status !== "cancelled" ? (
                        <button
                          type="button"
                          onClick={() => setStatus(r, "cancelled")}
                          disabled={pending}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
                        >
                          {ko ? "취소" : "Cancel"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStatus(r, "pending")}
                          disabled={pending}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
                        >
                          {ko ? "대기로" : "Reopen"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(r)}
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
