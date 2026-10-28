"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { submitIndustryRequestAction } from "@/app/(marketing)/industries/request/actions";

const DRAFT_KEY = "industry_request_draft";

interface Draft {
  name: string;
  description: string;
  needs: string;
  refUrl: string;
}
const EMPTY: Draft = { name: "", description: "", needs: "", refUrl: "" };

/**
 * 업종 추가 요청 폼. 로그아웃 상태에서도 작성 가능하되 제출은 로그인 필요 —
 * 작성 내용을 localStorage에 저장해 로그인 후 복원한다. 중복 제출 방지(전송 중 잠금).
 */
export function IndustryRequestForm({
  ko,
  loggedIn,
  loginHref,
}: {
  ko: boolean;
  loggedIn: boolean;
  loginHref: string;
}) {
  // 작성 내용 복원(로그인 왕복 후에도 유지) — 초기화 시 localStorage에서 1회 읽는다.
  // 저장된 초안이 없는 일반적인 경우엔 서버(EMPTY)와 동일해 하이드레이션 불일치가 없다.
  const [draft, setDraft] = useState<Draft>(() => {
    if (typeof window === "undefined") return EMPTY;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY;
    } catch {
      return EMPTY;
    }
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 변경 시 저장.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* 무시 */
    }
  }, [draft]);

  const set = (k: keyof Draft, v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!draft.name.trim()) {
      setError(ko ? "요청 업종명을 입력해주세요." : "Industry name is required.");
      return;
    }
    if (draft.description.trim().length < 5) {
      setError(ko ? "어떤 사업인지 조금 더 적어주세요." : "Please describe the business.");
      return;
    }
    setBusy(true);
    const res = await submitIndustryRequestAction({
      name: draft.name,
      description: draft.description,
      needs: draft.needs,
      refUrl: draft.refUrl,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* 무시 */
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-6 text-center">
        <p className="text-sm font-semibold text-foreground">
          {ko
            ? "요청이 접수되었습니다. 검토 후 반영 여부를 안내해드립니다."
            : "Your request was received. We'll review and get back to you."}
        </p>
        <Link
          href="/industries"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-semibold hover:border-primary"
        >
          {ko ? "업종 목록으로" : "Back to industries"}
        </Link>
      </div>
    );
  }

  const field =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <label className="block text-xs text-muted">
        {ko ? "요청 업종명" : "Industry name"} *
        <input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={60}
          placeholder={ko ? "예: 반려동물 미용" : "e.g. Pet grooming"}
          className={field}
        />
      </label>
      <label className="mt-3 block text-xs text-muted">
        {ko ? "어떤 사업인지 설명" : "What is the business?"} *
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={
            ko
              ? "어떤 고객에게 무엇을 제공하는 사업인지 적어주세요."
              : "Describe what you offer and to whom."
          }
          className={`${field} resize-none`}
        />
      </label>
      <label className="mt-3 block text-xs text-muted">
        {ko ? "필요한 콘텐츠·기능 (선택)" : "Needed content/features (optional)"}
        <input
          value={draft.needs}
          onChange={(e) => set("needs", e.target.value)}
          maxLength={500}
          placeholder={ko ? "예: 예약 안내, 가격표 카드" : "e.g. reservations, price cards"}
          className={field}
        />
      </label>
      <label className="mt-3 block text-xs text-muted">
        {ko ? "참고 사이트 (선택)" : "Reference site (optional)"}
        <input
          type="url"
          value={draft.refUrl}
          onChange={(e) => set("refUrl", e.target.value)}
          maxLength={300}
          placeholder="https://..."
          className={field}
        />
      </label>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4">
        {loggedIn ? (
          <button
            onClick={submit}
            disabled={busy}
            className="neon-glow inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {busy ? (ko ? "접수 중…" : "Submitting…") : ko ? "요청 접수" : "Submit request"}
          </button>
        ) : (
          <Link
            href={loginHref}
            className="neon-glow inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {ko ? "로그인하고 요청하기" : "Log in to submit"}
          </Link>
        )}
        <p className="mt-2 text-center text-xs text-muted">
          {ko
            ? "작성 내용은 이 브라우저에 임시 저장되어 로그인 후 복원됩니다."
            : "Your draft is saved in this browser and restored after login."}
        </p>
      </div>
    </div>
  );
}
