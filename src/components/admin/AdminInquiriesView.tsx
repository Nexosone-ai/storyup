"use client";

import { useMemo, useState } from "react";
import type { AdminInquiry } from "@/lib/admin/inquiries";

/** 관리자 문의고객 DB — 전체 사업체의 문의를 검색·열람한다. */
export function AdminInquiriesView({
  inquiries,
  total,
}: {
  inquiries: AdminInquiry[];
  total: number;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return inquiries;
    return inquiries.filter((i) =>
      [i.name, i.contact, i.kakao ?? "", i.message, i.businessName, i.ownerEmail]
        .join(" ")
        .toLowerCase()
        .includes(kw),
    );
  }, [inquiries, q]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">문의고객 DB</h2>
        <p className="mt-0.5 text-sm text-muted">
          전체 사업체의 랜딩페이지·블로그 이벤트 문의를 한곳에서 관리해요. (총{" "}
          {total.toLocaleString()}건)
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름·연락처·사업체·내용 검색"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
      />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          {q ? "검색 결과가 없어요." : "아직 접수된 문의가 없어요."}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((i) => (
            <li
              key={i.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{i.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    i.source === "blog"
                      ? "bg-primary-soft text-primary"
                      : "bg-surface-muted text-muted"
                  }`}
                >
                  {i.source === "blog" ? "블로그 이벤트" : "랜딩페이지"}
                </span>
                {!i.readAt && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    미확인
                  </span>
                )}
                <span className="ml-auto text-xs text-muted">
                  {fmt(i.createdAt)}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <a
                  href={
                    /@/.test(i.contact)
                      ? `mailto:${i.contact}`
                      : `tel:${i.contact.replace(/[^+\d]/g, "")}`
                  }
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {i.contact}
                </a>
                {i.kakao && (
                  <span className="text-muted">카톡 {i.kakao}</span>
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {i.message}
              </p>

              <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted">
                <span>사업체 · {i.businessName}</span>
                {i.ownerEmail && <span>소유자 · {i.ownerEmail}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
