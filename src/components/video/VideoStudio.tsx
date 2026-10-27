"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  submitVideoAction,
  pollVideoAction,
  generateCharacterAction,
  createVideoFrameUploadUrl,
} from "@/app/business/[id]/video/actions";
import { VideoEditor } from "@/components/video/VideoEditor";
import { VIDEO_LENGTHS, videoLengthById } from "@/lib/videoLength";
import { createClient } from "@/lib/supabase/client";

/** 기존 영상의 마지막 프레임을 캔버스로 추출(same-origin 프록시라 CORS 오염 없음). */
async function extractLastFrame(
  businessId: string,
  deliverableId: string,
): Promise<Blob> {
  const video = document.createElement("video");
  video.src = `/api/business/${businessId}/video/file?d=${deliverableId}`;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("영상을 불러오지 못했어요."));
  });
  // 끝으로 이동 — duration이 불명확(Infinity/NaN)하면 큰 값으로 점프(브라우저가 끝으로 클램프).
  const dur = video.duration;
  const target = Number.isFinite(dur) && dur > 0 ? Math.max(0, dur - 0.1) : 1e7;
  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error("마지막 장면을 읽지 못했어요."));
    video.currentTime = target;
  });
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 720;
  canvas.height = video.videoHeight || 1280;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("프레임 추출에 실패했어요.");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("프레임 저장에 실패했어요."))),
      "image/jpeg",
      0.9,
    ),
  );
}

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
  // 영상 길이 — 길수록 UP를 배수로 더 차감.
  const [lengthId, setLengthId] = useState(VIDEO_LENGTHS[0].id);
  // '이어서 만들기' — 기존 영상의 마지막 장면을 시작 프레임으로(charUrl 재사용).
  const [continuing, setContinuing] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  const length = videoLengthById(lengthId);
  const cost = pricing.price * length.multiplier;
  const notEnough = cost > 0 && pricing.balance < cost;

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

  // 기존 영상에서 '이어서 만들기' — 마지막 프레임 추출 → 업로드 → 시작 프레임으로 설정.
  const continueFrom = async (video: VideoItem) => {
    if (extractingId || busy) return;
    setExtractingId(video.id);
    setCharError(null);
    setError(null);
    try {
      const blob = await extractLastFrame(businessId, video.id);
      const ticket = await createVideoFrameUploadUrl(businessId);
      if (ticket.error || !ticket.path || !ticket.token || !ticket.publicUrl)
        throw new Error(ticket.error ?? "이어서 만들기 준비에 실패했어요.");
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("site-images")
        .uploadToSignedUrl(ticket.path, ticket.token, blob, {
          contentType: "image/jpeg",
        });
      if (upErr) throw new Error("프레임 업로드에 실패했어요. 다시 시도해주세요.");
      setCharUrl(ticket.publicUrl);
      setContinuing(true);
      setCharDesc("");
      // 사용자가 2단계(설명 입력)를 보도록 위로 스크롤.
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setCharError(
        err instanceof Error ? err.message : "이어서 만들기에 실패했어요.",
      );
    } finally {
      setExtractingId(null);
    }
  };

  const resetStart = () => {
    setCharUrl(null);
    setContinuing(false);
    setCharError(null);
  };

  const make = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setStatus("영상 생성 요청 중…");
    const res = await submitVideoAction(
      businessId,
      text,
      charUrl ?? undefined,
      lengthId,
    );
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
    <div ref={topRef} className="space-y-5">
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
            ? `UP이 부족해요. 선택한 길이(${length.label})에는 ${cost.toLocaleString()} UP이 필요합니다.`
            : `Not enough UP. The selected length costs ${cost.toLocaleString()} UP.`}
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
            {/* eslint-disable-next-line @next/next/no-img-element -- 시작 프레임/캐릭터 미리보기 */}
            <img
              src={charUrl}
              alt={ko ? "시작 장면" : "Start frame"}
              className="h-40 w-auto rounded-xl border border-border bg-black/5 object-contain"
            />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-primary">
                {continuing
                  ? ko
                    ? "✓ 이전 영상에 이어서 만듭니다"
                    : "✓ Continuing from your video"
                  : ko
                    ? "✓ 이 캐릭터로 영상을 만듭니다"
                    : "✓ Using this character"}
              </p>
              <div className="flex flex-wrap gap-2">
                {!continuing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={drawCharacter}
                    disabled={charBusy || !charDesc.trim()}
                  >
                    {charBusy ? <Spinner className="size-4" /> : ko ? "다시 그리기" : "Redraw"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetStart}
                  disabled={charBusy}
                >
                  {continuing
                    ? ko
                      ? "이어가기 취소"
                      : "Cancel"
                    : ko
                      ? "캐릭터 제거"
                      : "Remove"}
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
            {continuing
              ? ko
                ? "이전 영상의 마지막 장면에서 이어집니다. 다음에 이어질 장면을 설명해주세요."
                : "Continues from the last frame. Describe what happens next."
              : ko
                ? "설정한 캐릭터가 영상에 등장합니다. 캐릭터의 동작·장면을 설명해주세요."
                : "Your character will appear. Describe the action and scene."}
          </p>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder={
            continuing
              ? "이어질 장면을 설명하세요 (예: 같은 인물이 제품을 들어 보이며 환하게 웃는 장면)"
              : charUrl
                ? "캐릭터의 동작·장면을 설명하세요 (예: 카페에서 커피를 내리며 환하게 웃는 모습)"
                : "만들고 싶은 영상을 설명하세요 (예: 아늑한 카페에서 커피를 내리는 15초 홍보 영상)"
          }
          disabled={busy}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
        />

        {/* 영상 길이 — 길수록 UP 더 소진 */}
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-muted">
            {ko ? "영상 길이" : "Video length"}
          </p>
          <div className="flex flex-wrap gap-2">
            {VIDEO_LENGTHS.map((l) => {
              const c = pricing.price * l.multiplier;
              const selected = l.id === lengthId;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLengthId(l.id)}
                  disabled={busy}
                  aria-pressed={selected}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                    selected
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted hover:border-primary/50"
                  }`}
                >
                  <span className="block font-medium">{l.label}</span>
                  <span className="block text-xs text-muted">
                    {pricing.price > 0
                      ? `${c.toLocaleString()} UP`
                      : ko
                        ? "무료"
                        : "Free"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Button onClick={make} disabled={busy || !engineReady || !prompt.trim() || notEnough}>
            {busy ? (
              <Spinner className="size-4" />
            ) : ko ? (
              pricing.price > 0 ? `영상 만들기 (${cost.toLocaleString()} UP)` : "영상 만들기"
            ) : (
              "Make video"
            )}
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
                  <button
                    type="button"
                    onClick={() => continueFrom(v)}
                    disabled={extractingId !== null || busy}
                    className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 disabled:opacity-50"
                  >
                    {extractingId === v.id && <Spinner className="size-3.5" />}
                    {extractingId === v.id ? "불러오는 중…" : "이어서 만들기"}
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
