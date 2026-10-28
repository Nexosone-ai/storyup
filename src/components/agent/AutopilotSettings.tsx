"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  upsertRoutineAction,
  deleteRoutineAction,
  addUrlSourceAction,
  addPdfSourceAction,
  removeSourceAction,
  publishReviewNowAction,
  holdReviewAction,
  discardReviewAction,
  type RoutineInput,
} from "@/app/business/[id]/agent/autopilot/actions";
import {
  executeAgentProposal,
  rejectAgentProposal,
} from "@/app/business/[id]/agent/actions";

type Kind = "blog" | "cardnews" | "facebook";
type Autonomy = "propose" | "auto" | "review";

export interface RoutineRow {
  id: string;
  kind: Kind;
  cadence: "daily" | "weekly" | "biweekly" | "monthly";
  autonomy: Autonomy;
  review_hours: number;
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
export interface SourceRow {
  id: string;
  kind: "url" | "pdf";
  url: string | null;
  title: string;
  char_count: number;
  created_at: string;
}
export interface ReviewDraftRow {
  id: string;
  title: string;
  slug: string;
  scheduled_at: string | null;
  updated_at: string | null;
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
  const [autonomy, setAutonomy] = useState<Autonomy>(
    existing?.autonomy ?? (kind === "blog" ? "review" : "propose"),
  );
  const [reviewHours, setReviewHours] = useState(existing?.review_hours ?? 24);
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
        reviewHours,
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
            onChange={(e) => setAutonomy(e.target.value as Autonomy)}
            className={field}
          >
            <option value="propose">제안만(승인 후 실행)</option>
            {kind === "blog" && (
              <option value="review">검토 후 예약발행(추천)</option>
            )}
            <option value="auto">자동 실행(한도 내)</option>
          </select>
        </label>
        {kind === "blog" && autonomy === "review" && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            검토 창(시간)
            <input
              type="number"
              min={1}
              max={168}
              value={reviewHours}
              onChange={(e) => setReviewHours(Number(e.target.value))}
              className={field}
            />
          </label>
        )}
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
        <>
          <label className="mt-2 flex flex-col gap-1 text-xs text-muted">
            방향 힌트(선택) — 비우면 아래 글감에서 AI가 소재를 추립니다
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 신메뉴 소개, 계절 프로모션"
              className={field}
            />
          </label>
          {autonomy === "review" && (
            <p className="mt-2 rounded-lg border border-primary/30 bg-primary-soft/40 px-3 py-1.5 text-xs text-muted">
              AI가 글감으로 초안을 만들어 <strong>검토 큐</strong>에 올려요. 검토 창
              동안 보고·수정·지금발행·보류할 수 있고, 손대지 않으면 예약 시각에 자동
              발행됩니다.
            </p>
          )}
        </>
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

/** 브라우저에서 PDF 텍스트 추출(바이트는 서버로 보내지 않음). 스캔(이미지) PDF는 빈 텍스트. */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const maxPages = Math.min(doc.numPages, 30);
  let text = "";
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ") + "\n";
    if (text.length > 20_000) break;
  }
  return text.trim();
}

function SourcesManager({
  businessId,
  sources,
}: {
  businessId: string;
  sources: SourceRow[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addUrl = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await addUrlSourceAction(businessId, url.trim());
    setBusy(false);
    if (res.error) setMsg(res.error);
    else {
      setUrl("");
      router.refresh();
    }
  };

  const onPickPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMsg("PDF 파일만 올릴 수 있어요.");
      return;
    }
    setBusy(true);
    setMsg("PDF에서 텍스트를 읽는 중…");
    try {
      const text = await extractPdfText(file);
      if (text.length < 80) {
        setBusy(false);
        setMsg("PDF에서 읽은 텍스트가 너무 적어요(이미지 PDF는 지원 안 돼요).");
        return;
      }
      const res = await addPdfSourceAction(
        businessId,
        file.name.replace(/\.pdf$/i, ""),
        text,
      );
      setBusy(false);
      if (res.error) setMsg(res.error);
      else {
        setMsg(null);
        router.refresh();
      }
    } catch {
      setBusy(false);
      setMsg("PDF를 읽지 못했어요. 다른 파일을 써보세요.");
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    await removeSourceAction(businessId, id);
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-sm font-semibold">글감 소스 (URL · PDF)</h2>
      <p className="mt-1 text-xs text-muted">
        관련 웹페이지 주소나 PDF를 올려두면, 블로그 오토파일럿이 이 자료에 근거해
        글감을 추려 초안을 만들어요(없는 사실은 지어내지 않음). 최대 10개.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… 관련 기사·자료 주소"
          className={`${field} flex-1`}
          disabled={busy}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={addUrl} disabled={busy || !url.trim()}>
            URL 추가
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            PDF 올리기
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onPickPdf}
            className="hidden"
          />
        </div>
      </div>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}

      {sources.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="mr-1.5 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  {s.kind === "url" ? "웹" : "PDF"}
                </span>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
                <span className="ml-1.5 text-xs text-muted">
                  {s.char_count.toLocaleString()}자
                </span>
              </span>
              <button
                onClick={() => remove(s.id)}
                disabled={busy}
                className="shrink-0 text-xs text-muted hover:text-danger"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted">
          아직 등록된 글감이 없어요. 글감이 없으면 방향 힌트만으로 생성해요.
        </p>
      )}
    </div>
  );
}

function reviewWhen(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const diff = t - Date.now();
  const when = new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (diff <= 0) return `${when} · 곧 발행`;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const left = h >= 1 ? `${h}시간 후` : `${m}분 후`;
  return `${when} · ${left} 자동 발행`;
}

function ReviewQueue({
  businessId,
  drafts,
}: {
  businessId: string;
  drafts: ReviewDraftRow[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  if (drafts.length === 0) return null;

  const act = (
    fn: (b: string, id: string) => Promise<{ ok?: boolean; error?: string }>,
    id: string,
  ) =>
    startTransition(async () => {
      await fn(businessId, id);
      router.refresh();
    });

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary-soft/30 p-4 sm:p-5">
      <h2 className="text-sm font-semibold">
        발행 전 검토 큐 ({drafts.length})
      </h2>
      <p className="mt-1 text-xs text-muted">
        AI가 글감으로 만든 초안이에요. 예약 시각이 되면 자동 발행됩니다 — 그 전에
        내용을 확인하고 수정하세요.
      </p>
      <ul className="mt-3 space-y-2">
        {drafts.map((d) => (
          <li
            key={d.id}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{d.title}</span>
              <span className="shrink-0 text-xs text-muted">
                {reviewWhen(d.scheduled_at)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={`/business/${businessId}/blog/${d.id}`}
                className="rounded-lg border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
              >
                검토·수정
              </a>
              <button
                onClick={() => act(publishReviewNowAction, d.id)}
                disabled={busy}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs hover:border-primary"
              >
                지금 발행
              </button>
              <button
                onClick={() => act(holdReviewAction, d.id)}
                disabled={busy}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs hover:border-primary"
                title="예약을 멈추고 초안으로 보관(자동 발행 안 함)"
              >
                보류
              </button>
              <button
                onClick={() => act(discardReviewAction, d.id)}
                disabled={busy}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-muted hover:text-danger"
              >
                삭제
              </button>
            </div>
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
  sources,
  reviewDrafts,
  fbConnected,
}: {
  businessId: string;
  routines: RoutineRow[];
  logs: LogRow[];
  proposals: ProposalRow[];
  sources: SourceRow[];
  reviewDrafts: ReviewDraftRow[];
  fbConnected: boolean;
}) {
  const byKind = (k: Kind) => routines.find((r) => r.kind === k);
  const kinds: Kind[] = ["blog", "cardnews", "facebook"];

  return (
    <div className="space-y-4">
      <ReviewQueue businessId={businessId} drafts={reviewDrafts} />
      <ProposalInbox proposals={proposals} />
      <SourcesManager businessId={businessId} sources={sources} />

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
