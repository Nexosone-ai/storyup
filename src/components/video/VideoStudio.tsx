"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  submitVideoAction,
  pollVideoAction,
  generateCharacterAction,
} from "@/app/business/[id]/video/actions";
import { VideoEditor } from "@/components/video/VideoEditor";

interface Pricing {
  /** 영상 1편당 UP 단가. 0 = 무료. */
  price: number;
  /** 사용자 보유 UP. */
  balance: number;
}
interface VideoItem {
  id: string;
  title: string | null;
  url: string;
  createdAt: string;
}

export function VideoStudio({
  businessId,
  pricing,
  engineReady,
  videos,
  ko,
}: {
  businessId: string;
  pricing: Pricing;
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
  // 1단계 — AI 캐릭터 그리기(선택). 캐릭터를 정하면 그 인물이 영상에 등장(image-to-video).
  const [charDesc, setCharDesc] = useState("");
  const [charUrl, setCharUrl] = useState<string | null>(null);
  const [charBusy, setCharBusy] = useState(false);
  const [charError, setCharError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const notEnough = pricing.price > 0 && pricing.balance < pricing.price;

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

  const drawCharacter = async () => {
    const text = charDesc.trim();
    if (!text || charBusy) return;
    setCharBusy(true);
    setCharError(null);
    const res = await generateCharacterAction(businessId, text);
    setCharBusy(false);
    if (res.error || !res.url) {
      setCharError(res.error ?? "캐릭터 생성에 실패했어요.");
      return;
    }
    setCharUrl(res.url);
  };

  const make = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setStatus("영상 생성 요청 중…");
    const res = await submitVideoAction(businessId, text, charUrl ?? undefined);
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
      {/* 과금 안내 — 1편당 UP 차감 + 보유 UP */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm">
          {ko ? "영상 1편당" : "Per video"}:{" "}
          <strong>
            {pricing.price > 0
              ? `${pricing.price.toLocaleString()} UP`
              : ko
                ? "무료"
                : "Free"}
          </strong>
          <span className="text-muted">
            {" · "}
            {ko ? "보유" : "Balance"} {pricing.balance.toLocaleString()} UP
          </span>
        </p>
        <ButtonLink size="sm" variant="outline" href="/dashboard/points">
          {ko ? "UP 충전" : "Get UP"}
        </ButtonLink>
      </div>

      {notEnough && (
        <p className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning">
          {ko
            ? `UP이 부족해요. 영상 1편에 ${pricing.price.toLocaleString()} UP이 필요합니다.`
            : `Not enough UP. Each video costs ${pricing.price.toLocaleString()} UP.`}
        </p>
      )}

      {!engineReady && (
        <p className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-sm text-muted">
          영상 엔진이 아직 설정되지 않았어요(관리자 설정 필요). 설정되면 바로 생성할 수 있어요.
        </p>
      )}

      {/* 1단계 — AI 캐릭터 그리기(선택) */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            1
          </span>
          <h2 className="text-sm font-semibold">
            {ko ? "캐릭터 그리기 (선택)" : "Draw a character (optional)"}
          </h2>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted">
          {ko
            ? "영상에 등장시킬 인물·마스코트를 먼저 AI로 그려두면, 그 캐릭터가 영상에 나옵니다. 건너뛰면 설명만으로 영상을 만들어요."
            : "Draw a person or mascot first and it will appear in your video. Skip to make a video from text only."}
        </p>

        {charUrl ? (
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- 사용자 생성 캐릭터 미리보기 */}
            <img
              src={charUrl}
              alt={ko ? "생성된 캐릭터" : "Character"}
              className="h-40 w-auto rounded-xl border border-border bg-black/5 object-contain"
            />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-primary">
                {ko ? "✓ 이 캐릭터로 영상을 만듭니다" : "✓ Using this character"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={drawCharacter}
                  disabled={charBusy || !charDesc.trim()}
                >
                  {charBusy ? <Spinner className="size-4" /> : ko ? "다시 그리기" : "Redraw"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCharUrl(null);
                    setCharError(null);
                  }}
                  disabled={charBusy}
                >
                  {ko ? "캐릭터 제거" : "Remove"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={charDesc}
              onChange={(e) => setCharDesc(e.target.value)}
              rows={2}
              placeholder={
                ko
                  ? "캐릭터를 설명하세요 (예: 따뜻한 미소의 한국인 여성 바리스타, 베이지 앞치마)"
                  : "Describe the character (e.g. a friendly female barista in a beige apron)"
              }
              disabled={charBusy}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button
                variant="outline"
                onClick={drawCharacter}
                disabled={charBusy || !charDesc.trim()}
              >
                {charBusy ? (
                  <Spinner className="size-4" />
                ) : ko ? (
                  "AI로 캐릭터 그리기"
                ) : (
                  "Draw with AI"
                )}
              </Button>
              {charBusy && (
                <span className="text-sm text-muted">
                  {ko ? "캐릭터를 그리고 있어요…" : "Drawing…"}
                </span>
              )}
            </div>
          </>
        )}
        {charError && <p className="mt-2 text-sm text-danger">{charError}</p>}
      </div>

      {/* 2단계 — 영상 만들기 */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            2
          </span>
          <h2 className="text-sm font-semibold">
            {ko ? "영상 만들기" : "Make the video"}
          </h2>
        </div>
        {charUrl && (
          <p className="mb-2 text-xs text-primary">
            {ko
              ? "설정한 캐릭터가 영상에 등장합니다. 캐릭터의 동작·장면을 설명해주세요."
              : "Your character will appear. Describe the action and scene."}
          </p>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder={
            charUrl
              ? "캐릭터의 동작·장면을 설명하세요 (예: 카페에서 커피를 내리며 환하게 웃는 모습)"
              : "만들고 싶은 영상을 설명하세요 (예: 아늑한 카페에서 커피를 내리는 15초 홍보 영상)"
          }
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
          businessId={businessId}
          fileUrl={`/api/business/${businessId}/video/file?d=${editing.id}`}
          title={editing.title}
          ko={ko}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
