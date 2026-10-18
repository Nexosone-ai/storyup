"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

export interface PartnerProfileInit {
  display_name: string;
  bio: string | null;
  work_status: string | null;
  history: string | null;
  portfolio_url: string | null;
  contact: string | null;
  skills: string[];
  status?: string;
}

export interface ProfileInput {
  display_name: string;
  bio?: string;
  work_status?: string;
  history?: string;
  portfolio_url?: string;
  contact?: string;
  skills?: string[];
}

type SaveResult = { ok?: boolean; error?: string; status?: string };

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

const STATUS_NOTE: Record<string, string> = {
  pending: "관리자 승인 대기 중이에요. 승인되면 서포터즈에 노출됩니다.",
  active: "승인 완료 — 서포터즈에 노출 중이에요.",
  rejected: "반려되었습니다. 내용을 보완해 다시 저장해주세요.",
};

/**
 * 서포터(파트너) 프로필/신청 폼 — 작업 현황·이력을 올려 클라에게 노출.
 * action은 서버 액션(프로필 저장 또는 신청)으로 주입한다.
 */
export function PartnerProfileEditor({
  init,
  action,
  heading = "내 서포터 프로필",
  intro = "작업 현황·이력을 올리면 클라이언트가 대행 문의 시 담당자 정보로 봅니다.",
}: {
  init: PartnerProfileInit | null;
  action: (input: ProfileInput) => Promise<SaveResult>;
  heading?: string;
  intro?: string;
}) {
  const [name, setName] = useState(init?.display_name ?? "");
  const [workStatus, setWorkStatus] = useState(init?.work_status ?? "");
  const [bio, setBio] = useState(init?.bio ?? "");
  const [history, setHistory] = useState(init?.history ?? "");
  const [portfolio, setPortfolio] = useState(init?.portfolio_url ?? "");
  const [contact, setContact] = useState(init?.contact ?? "");
  const [skills, setSkills] = useState((init?.skills ?? []).join(", "));
  const [status, setStatus] = useState(init?.status);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setMsg(null);
      setError(null);
      const res = await action({
        display_name: name,
        bio,
        work_status: workStatus,
        history,
        portfolio_url: portfolio,
        contact,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (res.error) setError(res.error);
      else {
        if (res.status) setStatus(res.status);
        setMsg("저장했어요.");
      }
    });

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{heading}</h2>
        {status && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              status === "active"
                ? "bg-primary-soft/40 text-primary"
                : status === "rejected"
                  ? "bg-danger/10 text-danger"
                  : "bg-surface-muted text-muted"
            }`}
          >
            {status === "active" ? "승인됨" : status === "rejected" ? "반려" : "승인 대기"}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">{intro}</p>
      {status && STATUS_NOTE[status] && (
        <p className="mt-1 text-xs text-muted">{STATUS_NOTE[status]}</p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          표시 이름
          <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${field}`} placeholder="예: 스토리업 대행팀 / 김대행" />
        </label>
        <label className="text-xs text-muted">
          작업 현황
          <input value={workStatus} onChange={(e) => setWorkStatus(e.target.value)} className={`mt-1 ${field}`} placeholder="예: 수주 가능 · 1주 대기" />
        </label>
      </div>
      <label className="mt-2 block text-xs text-muted">
        한 줄 소개
        <input value={bio} onChange={(e) => setBio(e.target.value)} className={`mt-1 ${field}`} placeholder="예: 로컬 맛집 전문 블로그·쇼츠 대행" />
      </label>
      <label className="mt-2 block text-xs text-muted">
        경력·이력
        <textarea value={history} onChange={(e) => setHistory(e.target.value)} rows={4} className={`mt-1 resize-none ${field}`} placeholder="예: 2024~ 카페 20곳 블로그 운영, 월 평균 방문 3배 ..." />
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          포트폴리오 URL
          <input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} className={`mt-1 ${field}`} placeholder="https://" />
        </label>
        <label className="text-xs text-muted">
          연락처(선택)
          <input value={contact} onChange={(e) => setContact(e.target.value)} className={`mt-1 ${field}`} placeholder="이메일/전화" />
        </label>
      </div>
      <label className="mt-2 block text-xs text-muted">
        전문 분야(쉼표 구분)
        <input value={skills} onChange={(e) => setSkills(e.target.value)} className={`mt-1 ${field}`} placeholder="블로그, 쇼츠, 카드뉴스" />
      </label>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          저장
        </Button>
        {msg && <span className="text-xs text-primary">{msg}</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
