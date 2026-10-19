"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import {
  createMusicBed,
  SHORTS_MOODS,
  type ShortsMood,
} from "@/lib/shorts/music";
import {
  createEditedVideoUploadUrl,
  registerEditedVideo,
} from "@/app/business/[id]/video/actions";

/**
 * 브라우저 영상 편집기 — 완성된 AI 영상을 자르기·자막·배경음악·비율로 다듬어
 * canvas + MediaRecorder로 '로컬 재인코딩'한다(서버 전송·fal 재호출 없음 = 추가 비용 0).
 * 영상 소스는 same-origin 프록시(/api/business/[id]/video/file)라 canvas 오염이 없다.
 */

type Aspect = "orig" | "9:16" | "1:1" | "16:9";
type TextPos = "top" | "mid" | "bot";

const ASPECTS: { id: Aspect; ko: string; en: string }[] = [
  { id: "orig", ko: "원본", en: "Original" },
  { id: "9:16", ko: "9:16 (쇼츠)", en: "9:16" },
  { id: "1:1", ko: "1:1 (정사각)", en: "1:1" },
  { id: "16:9", ko: "16:9 (가로)", en: "16:9" },
];
const POSITIONS: { id: TextPos; ko: string; en: string }[] = [
  { id: "top", ko: "상단", en: "Top" },
  { id: "mid", ko: "중앙", en: "Middle" },
  { id: "bot", ko: "하단", en: "Bottom" },
];

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

function pickMime(): { mime: string; ext: string } {
  const cands = [
    { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of cands) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch {
      /* ignore */
    }
  }
  return { mime: "", ext: "webm" };
}

function targetSize(aspect: Aspect, vw: number, vh: number) {
  if (aspect === "9:16") return { W: 720, H: 1280 };
  if (aspect === "1:1") return { W: 1080, H: 1080 };
  if (aspect === "16:9") return { W: 1280, H: 720 };
  return { W: even(vw || 1280), H: even(vh || 720) };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  v: HTMLVideoElement,
  W: number,
  H: number,
) {
  const vw = v.videoWidth || W;
  const vh = v.videoHeight || H;
  const scale = Math.max(W / vw, H / vh);
  const w = vw * scale;
  const h = vh * scale;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  pos: TextPos,
  W: number,
  H: number,
) {
  const fontSize = Math.round(W * 0.055);
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Noto Sans KR", "Malgun Gothic", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxW = W * 0.9;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);

  const lineH = fontSize * 1.28;
  const totalH = lines.length * lineH;
  const cy = pos === "top" ? H * 0.12 + totalH / 2 : pos === "bot" ? H * 0.88 - totalH / 2 : H / 2;
  const startY = cy - totalH / 2 + lineH / 2;
  lines.forEach((ln, i) => {
    const y = startY + i * lineH;
    ctx.lineWidth = Math.max(4, fontSize * 0.14);
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(ln, W / 2, y);
    ctx.fillStyle = "#fff";
    ctx.fillText(ln, W / 2, y);
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      v.removeEventListener("seeked", onSeeked);
      resolve();
    };
    v.addEventListener("seeked", onSeeked);
    v.currentTime = t;
  });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export function VideoEditor({
  businessId,
  fileUrl,
  title,
  ko,
  onClose,
}: {
  businessId: string;
  fileUrl: string;
  title: string | null;
  ko: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [aspect, setAspect] = useState<Aspect>("orig");
  const [text, setText] = useState("");
  const [textPos, setTextPos] = useState<TextPos>("bot");
  const [mood, setMood] = useState<ShortsMood>("none");
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = isFinite(v.duration) ? v.duration : 0;
    setDuration(d);
    setEnd(d);
    setStart(0);
  };

  const run = async (after: (blob: Blob, ext: string) => Promise<void>) => {
    const v = videoRef.current;
    if (!v || busy) return;
    const dur = Math.max(0.3, end - start);
    setBusy(true);
    setProgress(0);
    setError(null);
    setSaved(false);

    let actx: AudioContext | null = null;
    let bed: ReturnType<typeof createMusicBed> | null = null;
    let cStream: MediaStream | null = null;
    const wasMuted = v.muted;
    try {
      const { W, H } = targetSize(aspect, v.videoWidth, v.videoHeight);
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("캔버스를 초기화하지 못했어요.");

      const fps = 30;
      cStream = canvas.captureStream(fps);
      const tracks: MediaStreamTrack[] = [...cStream.getVideoTracks()];

      if (mood !== "none") {
        v.muted = true;
        actx = new AudioContext();
        bed = createMusicBed(actx, mood, dur);
        if (bed.stream) tracks.push(...bed.stream.getAudioTracks());
      } else if (keepOriginal) {
        v.muted = false;
        const cap =
          (v as unknown as { captureStream?: () => MediaStream }).captureStream?.bind(v) ??
          (v as unknown as { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.bind(v);
        const vs = cap?.();
        const at = vs?.getAudioTracks() ?? [];
        if (at.length) tracks.push(at[0]);
      } else {
        v.muted = true;
      }

      const stream = new MediaStream(tracks);
      const { mime, ext } = pickMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: recorder.mimeType || mime || "video/webm" }));
        recorder.onerror = () => reject(new Error("녹화에 실패했어요."));
      });

      await seek(v, start);
      recorder.start();
      bed?.start();
      await v.play();

      await new Promise<void>((resolve) => {
        let raf = 0;
        const step = () => {
          const cur = v.currentTime;
          if (cur >= end || v.ended) {
            cancelAnimationFrame(raf);
            resolve();
            return;
          }
          drawCover(ctx, v, W, H);
          if (text.trim()) drawText(ctx, text.trim(), textPos, W, H);
          setProgress(clamp01((cur - start) / dur));
          raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      });

      v.pause();
      // 마지막 프레임까지 담기도록 잠깐 뒤 정지.
      setTimeout(() => {
        try {
          recorder.stop();
        } catch {
          /* noop */
        }
      }, 120);
      const blob = await finished;
      await after(blob, ext);
      setProgress(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "편집 중 오류가 발생했어요.");
    } finally {
      bed?.stop();
      cStream?.getTracks().forEach((t) => t.stop());
      actx?.close().catch(() => {});
      v.muted = wasMuted;
      setBusy(false);
    }
  };

  const baseName = () =>
    (title?.trim() || "storyup-video")
      .replace(/[^\w가-힣\- ]+/g, "")
      .trim()
      .slice(0, 40) || "storyup-video";

  const handleDownload = () =>
    run(async (blob, ext) => {
      downloadBlob(blob, `${baseName()}-편집.${ext}`);
    });

  const handleSave = () =>
    run(async (blob, ext) => {
      setSaving(true);
      try {
        const ticket = await createEditedVideoUploadUrl(businessId, ext);
        if (ticket.error || !ticket.path || !ticket.token)
          throw new Error(ticket.error ?? "업로드 준비에 실패했어요.");
        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from("site-images")
          .uploadToSignedUrl(ticket.path, ticket.token, blob, {
            contentType: blob.type || "video/mp4",
          });
        if (upErr) throw new Error("업로드에 실패했어요. 다시 시도해주세요.");
        const reg = await registerEditedVideo(
          businessId,
          ticket.path,
          `${title?.trim() || "영상"} (편집본)`,
        );
        if (reg.error) throw new Error(reg.error);
        setSaved(true);
        router.refresh();
        setTimeout(() => onClose(), 1000);
      } finally {
        setSaving(false);
      }
    });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{ko ? "영상 편집" : "Edit video"}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm text-muted hover:text-foreground disabled:opacity-50"
          >
            {ko ? "닫기" : "Close"}
          </button>
        </div>

        <video
          ref={videoRef}
          src={fileUrl}
          controls
          playsInline
          onLoadedMetadata={onMeta}
          className="mb-4 w-full rounded-lg bg-black"
          style={{ maxHeight: "40vh" }}
        />

        {/* 자르기 */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>{ko ? "자르기" : "Trim"}</span>
            <span>
              {fmt(start)} ~ {fmt(end)} ({(end - start).toFixed(1)}
              {ko ? "초" : "s"})
            </span>
          </div>
          <label className="mb-1.5 block text-xs text-muted">
            {ko ? "시작" : "Start"}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={start}
              disabled={busy || !duration}
              onChange={(e) => {
                const val = Math.min(Number(e.target.value), end - 0.3);
                setStart(Math.max(0, val));
                if (videoRef.current) videoRef.current.currentTime = Math.max(0, val);
              }}
              className="w-full"
            />
          </label>
          <label className="block text-xs text-muted">
            {ko ? "끝" : "End"}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={end}
              disabled={busy || !duration}
              onChange={(e) => {
                const val = Math.max(Number(e.target.value), start + 0.3);
                setEnd(Math.min(duration, val));
              }}
              className="w-full"
            />
          </label>
        </div>

        {/* 비율 */}
        <div className="mb-4">
          <p className="mb-1.5 text-xs text-muted">{ko ? "비율" : "Aspect"}</p>
          <div className="flex flex-wrap gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={busy}
                onClick={() => setAspect(a.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  aspect === a.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted hover:border-primary/50"
                } disabled:opacity-50`}
              >
                {ko ? a.ko : a.en}
              </button>
            ))}
          </div>
        </div>

        {/* 자막 */}
        <div className="mb-4">
          <p className="mb-1.5 text-xs text-muted">{ko ? "자막 / 문구" : "Caption"}</p>
          <input
            type="text"
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            placeholder={ko ? "영상에 넣을 문구 (선택)" : "Text overlay (optional)"}
            className="mb-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
          />
          {text.trim() && (
            <div className="flex gap-2">
              {POSITIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setTextPos(p.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    textPos === p.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:border-primary/50"
                  } disabled:opacity-50`}
                >
                  {ko ? p.ko : p.en}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 음악 */}
        <div className="mb-4">
          <p className="mb-1.5 text-xs text-muted">{ko ? "배경음악" : "Music"}</p>
          <select
            value={mood}
            disabled={busy}
            onChange={(e) => setMood(e.target.value as ShortsMood)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
          >
            {SHORTS_MOODS.map((m) => (
              <option key={m.id} value={m.id}>
                {ko ? m.ko : m.en}
              </option>
            ))}
          </select>
          {mood === "none" ? (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={keepOriginal}
                disabled={busy}
                onChange={(e) => setKeepOriginal(e.target.checked)}
              />
              {ko ? "원본 소리 유지" : "Keep original audio"}
            </label>
          ) : (
            <p className="mt-2 text-xs text-muted">
              {ko
                ? "배경음악을 넣으면 원본 소리는 음소거됩니다."
                : "Original audio is muted when music is added."}
            </p>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={busy || !duration}>
            {busy && saving ? (
              <Spinner className="size-4" />
            ) : ko ? (
              "내 영상에 저장"
            ) : (
              "Save to my videos"
            )}
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={busy || !duration}>
            {busy && !saving ? (
              <Spinner className="size-4" />
            ) : ko ? (
              "다운로드"
            ) : (
              "Download"
            )}
          </Button>
          {busy && (
            <span className="text-sm text-muted">
              {saving
                ? ko
                  ? "저장 중"
                  : "Saving"
                : ko
                  ? "만드는 중"
                  : "Rendering"}{" "}
              {Math.round(progress * 100)}%
            </span>
          )}
          {!busy && saved && (
            <span className="text-sm text-primary">
              {ko ? "내 영상에 저장됐어요" : "Saved to my videos"}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          {ko
            ? "편집은 브라우저에서 처리되어 추가 비용이 들지 않아요. '내 영상에 저장'하면 랜딩·블로그·SNS에 바로 쓸 수 있고, '다운로드'는 기기에 저장합니다."
            : "Editing runs in your browser at no extra cost. Save to reuse it anywhere, or download to your device."}
        </p>
      </div>
    </div>
  );
}
