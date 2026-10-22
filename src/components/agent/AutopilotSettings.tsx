"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  upsertRoutineAction,
  deleteRoutineAction,
  type RoutineInput,
} from "@/app/business/[id]/agent/autopilot/actions";
import {
  executeAgentProposal,
  rejectAgentProposal,
} from "@/app/business/[id]/agent/actions";

type Kind = "blog" | "cardnews" | "facebook";

export interface RoutineRow {
  id: string;
  kind: Kind;
  cadence: "daily" | "weekly" | "biweekly" | "monthly";
  autonomy: "propose" | "auto";
  enabled: boolean;
  max_per_day: number;
  monthly_cap: number;
  quiet_start: number | null;
  quiet_end: number | null;
  params: Record<string, unknown> | null;
  last_run_at: string | null;
}
export interface LogRow {
  id: string;
  action: string;
  status: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}
export interface ProposalRow {
  id: string;
  action: string;
  params: Record<string, unknown> | null;
}

const KIND_LABEL: Record<Kind, string> = {
  blog: "블로그 자동 생성",
  cardnews: "카드뉴스 자동 생성",
  facebook: "Facebook 자동 게시",
};
const CADENCE_LABEL: Record<string, string> = {
  daily: "매일",
  weekly: "매주",
  biweekly: "격주",
  monthly: "매월",
};
const STATUS_LABEL: Record<string, string> = {
  done: "실행됨",
  proposed: "제안됨",
  failed: "실패",
  skip: "건너뜀",
};

const field =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary";

function RoutineCard({
  businessId,
  kind,
  existing,
  fbConnected,
}: {
  businessId: string;
  kind: Kind;
  existing?: RoutineRow;
  fbConnected: boolean;
}) {
  const [enabled, setEnabled] = useState(existing?.enabled ?? false);
  const [autonomy, setAutonomy] = useState<"propose" | "auto">(
    existing?.autonomy ?? "propose",
  );
  const [cadence, setCadence] = useState(existing?.cadence ?? "weekly");
  const [maxPerDay, setMaxPerDay] = useState(existing?.max_per_day ?? 1);
  const [monthlyCap, setMonthlyCap] = useState(existing?.monthly_cap ?? 10);
  const [quietStart, setQuietStart] = useState<string>(
    existing?.quiet_start != null ? String(existing.quiet_start) : "",
  );
  const [quietEnd, setQuietEnd] = useState<string>(
    existing?.quiet_end != null ? String(existing.quiet_end) : "",
  );
  const [topic, setTopic] = useState(
    (existing?.params?.topic as string | undefined) ?? "",
  );
  const [message, setMessage] = useState(
    (existing?.params?.message as string | undefined) ?? "",
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setMsg(null);
      const input: RoutineInput = {
        id: existing?.id,
        kind,
        cadence,
        autonomy,
        enabled,
        maxPerDay,
        monthlyCap,
        quietStart: quietStart === "" ? null : Number(quietStart),
        quietEnd: quietEnd === "" ? null : Number(quietEnd),
        topic: kind === "blog" ? topic : undefined,
        message: kind === "facebook" ? message : undefined,
      };
      const res = await upsertRoutineAction(businessId, input);
      setMsg(res.error ?? "저장됐어요.");
    });

  const remove = () =>
    startTransition(async () => {
      if (!existing) return;
      await deleteRoutineAction(businessId, existing.id);
      setEnabled(false);
      setMsg("삭제됐어요. (새로고침 시 사라집니다)");
    });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{KIND_LABEL[kind]}</h3>
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
            enabled
              ? "border-primary bg-primary-soft text-primary"
              : "border-border bg-surface text-muted"
          }`}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          {enabled ? "자동 실행 켜짐" : "꺼짐 — 체크해 켜기"}
        </label>
      </div>
      {!enabled && (
        <p className="mt-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-1.5 text-xs text-warning">
          지금은 꺼져 있어 자동으로 실행되지 않아요. 위 스위치를 <strong>켜짐</strong>으로
          체크한 뒤 <strong>저장</strong>해야 동작합니다.
        </p>
      )}

      {kind === "facebook" && !fbConnected && (
        <p className="mt-2 text-xs text-danger">
          Facebook 페이지가 연결돼 있어야 동작해요. 에이전트 화면에서 먼저 연결하세요.
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          실행 방식
          <select
            value={autonomy}
            onChange={(e) => setAutonomy(e.target.value as "propose" | "auto")}
            className={field}
          >
            <option value="propose">제안만(승인 후 실행)</option>
            <option value="auto">자동 실행(한도 내)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          주기
          <select
            value={cadence}
            onChange={(e) =>
              setCadence(e.target.value as RoutineRow["cadence"])
            }
            className={field}
          >
            {Object.entries(CADENCE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          하루 최대
          <input
            type="number"
            min={1}
            max={20}
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(Number(e.target.value))}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          월 최대(0=무제한)
          <input
            type="number"
            min={0}
            max={200}
            value={monthlyCap}
            onChange={(e) => setMonthlyCap(Number(e.target.value))}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          조용한 시간 시작
          <input
            type="number"
            min={0}
            max={23}
            placeholder="예: 22"
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          조용한 시간 끝
          <input
            type="number"
            min={0}
            max={23}
            placeholder="예: 8"
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
            className={field}
          />
        </label>
      </div>

      {kind === "blog" && (
        <label className="mt-2 flex flex-col gap-1 text-xs text-muted">
          주제 힌트(선택)
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 신메뉴 소개, 계절 프로모션"
            className={field}
          />
        </label>
      )}
      {kind === "facebook" && (
        <label className="mt-2 flex flex-col gap-1 text-xs text-muted">
          게시 문구(선택, 비우면 최신 글로 자동 작성)
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="예: 이번 주 신메뉴를 소개합니다!"
            className={field}
          />
        </label>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          저장
        </Button>
        {existing && (
          <Button
            size="sm"
            variant="outline"
            onClick={remove}
            disabled={pending}
          >
            삭제
          </Button>
        )}
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </div>
  );
}

function proposalSummary(p: ProposalRow): string {
  const params = p.params ?? {};
  if (p.action === "generate_blog_draft")
    return `블로그 초안: ${(params.topic as string) ?? ""}`;
  if (p.action === "generate_cardnews") return "카드뉴스 생성";
  if (p.action === "publish_facebook")
    return `Facebook 게시: ${(params.message as string) ?? ""}`;
  return p.action;
}

function ProposalInbox({ proposals }: { proposals: ProposalRow[] }) {
  const [items, setItems] = useState(
    proposals.map((p) => ({ ...p, state: "pending" as string })),
  );
  const [pending, startTransition] = useTransition();
  if (items.length === 0) return null;

  const act = (id: string, approve: boolean) =>
    startTransition(async () => {
      if (approve) await executeAgentProposal(id);
      else await rejectAgentProposal(id);
      setItems((xs) =>
        xs.map((x) =>
          x.id === id ? { ...x, state: approve ? "done" : "rejected" } : x,
        ),
      );
    });

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-sm font-semibold">오토파일럿 제안 ({items.length})</h2>
      <p className="mt-1 text-xs text-muted">
        자동으로 쌓인 제안이에요. 승인하면 실행됩니다.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate">{proposalSummary(p)}</span>
            {p.state === "pending" ? (
              <span className="flex gap-2">
                <Button size="sm" onClick={() => act(p.id, true)} disabled={pending}>
                  승인·실행
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(p.id, false)}
                  disabled={pending}
                >
                  거절
                </Button>
              </span>
            ) : (
              <span className="text-xs text-muted">
                {p.state === "done" ? "완료됨" : "거절됨"}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AutopilotSettings({
  businessId,
  routines,
  logs,
  proposals,
  fbConnected,
}: {
  businessId: string;
  routines: RoutineRow[];
  logs: LogRow[];
  proposals: ProposalRow[];
  fbConnected: boolean;
}) {
  const byKind = (k: Kind) => routines.find((r) => r.kind === k);
  const kinds: Kind[] = ["blog", "cardnews", "facebook"];

  return (
    <div className="space-y-4">
      <ProposalInbox proposals={proposals} />

      <div className="grid gap-3">
        {kinds.map((k) => (
          <RoutineCard
            key={k}
            businessId={businessId}
            kind={k}
            existing={byKind(k)}
            fbConnected={fbConnected}
          />
        ))}
      </div>

      {logs.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-sm font-semibold">최근 실행 기록</h2>
          <ul className="mt-3 space-y-1.5 text-xs">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 text-muted"
              >
                <span>
                  {KIND_LABEL[l.action as Kind] ?? l.action} ·{" "}
                  {STATUS_LABEL[l.status] ?? l.status}
                  {l.detail?.note ? ` (${String(l.detail.note)})` : ""}
                </span>
                <span>{new Date(l.created_at).toLocaleString("ko-KR")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
