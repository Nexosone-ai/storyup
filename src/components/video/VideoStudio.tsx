"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { submitVideoAction, pollVideoAction } from "@/app/business/[id]/video/actions";
import { VideoEditor } from "@/components/video/VideoEditor";

interface Quota {
  freeLimit: number | null;
  freeUsed: number;
  purchased: number;
  available: number | null;
}
interface VideoItem {
  id: string;
  title: string | null;
  url: string;
  createdAt: string;
}

export function VideoStudio({
  businessId,
  quota,
  engineReady,
  videos,
  ko,
}: {
  businessId: string;
  quota: Quota;
  engineReady: boolean;
  videos: VideoItem[];
  ko: boolean;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<VideoItem | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const freeRemaining =
    quota.freeLimit === null
      ? null
      : Math.max(0, quota.freeLimit - quota.freeUsed);

  const poll = (jobId: string) => {
    let tries = 0;
    timer.current = setInterval(async () => {
      tries++;
      const res = await pollVideoAction(jobId);
      if (res.status === "done") {
        stop();
        setStatus(null);
        setBusy(false);
        router.refresh();
      } else if (res.status === "failed") {
        stop();
        setBusy(false);
        setStatus(null);
        setError(res.error ?? "영상 생성에 실패했어요.");
      } else if (tries > 60) {
        // ~5분 초과 — 백그라운드로 처리 중. 목록 새로고침으로 확인.
        stop();
        setBusy(false);
        setStatus("처리가 길어지고 있어요. 잠시 후 목록을 새로고침해 확인해주세요.");
      }
    }, 5000);
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const make = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setStatus("영상 생성 요청 중…");
    const res = await submitVideoAction(businessId, text);
    if (res.error || !res.jobId) {
      setBusy(false);
      setStatus(null);
      setError(res.error ?? "요청에 실패했어요.");
      return;
    }
    setStatus("AI가 영상을 만들고 있어요… (수십 초~수 분)");
    poll(res.jobId);
  };

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(url);
  };

  return (
    <div className="space-y-5">
      {/* 쿼터 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm">
          {ko ? "이번 달 무료" : "Free this month"}:{" "}
          <strong>
            {freeRemaining === null ? "무제한" : `${freeRemaining}편`}
          </strong>
          {quota.purchased > 0 && (
            <span className="text-muted"> · 구매 {quota.purchased}편</span>
          )}
        </p>
        <ButtonLink size="sm" variant="outline" href="/pay/video-pack-10">
          {ko ? "영상 팩 구매" : "Buy pack"}
        </ButtonLink>
      </div>

      {!engineReady && (
        <p className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm text-muted">
          영상 엔진이 아직 설정되지 않았어요(관리자 설정 필요). 설정되면 바로 생성할 수 있어요.
        </p>
      )}

      {/* 생성 */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="만들고 싶은 영상을 설명하세요 (예: 아늑한 카페에서 커피를 내리는 15초 홍보 영상)"
          disabled={busy}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={make} disabled={busy || !engineReady || !prompt.trim()}>
            {busy ? <Spinner className="size-4" /> : ko ? "영상 만들기" : "Make video"}
          </Button>
          {status && <span className="text-sm text-muted">{status}</span>}
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {/* 내 영상 */}
      {videos.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">{ko ? "내 영상" : "My videos"}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {videos.map((v) => (
              <li key={v.id} className="rounded-xl border border-border bg-surface p-3">
                {v.title && <p className="truncate text-sm font-medium">{v.title}</p>}
                <video src={v.url} controls className="mt-2 w-full rounded-lg bg-black" />
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <a
                    href={v.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    다운로드
                  </a>
                  <button
                    type="button"
                    onClick={() => copy(v.url)}
                    className="text-muted underline-offset-2 hover:text-primary hover:underline"
                  >
                    {copied === v.url ? "복사됨" : "링크 복사"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(v)}
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    편집
                  </button>
                  <span className="text-muted">랜딩·블로그·SNS에 붙여 사용</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <VideoEditor
          fileUrl={`/api/business/${businessId}/video/file?d=${editing.id}`}
          title={editing.title}
          ko={ko}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
