"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea, Label, Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { GeneratingScreen } from "@/components/ai/GeneratingScreen";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { createVoiceUploadUrl } from "@/app/business/actions";
import { cn } from "@/utils/cn";
import {
  BLOG_TONES,
  BLOG_LENGTHS,
  BLOG_TONE_LABEL,
  BLOG_LENGTH_LABEL,
  type BlogTone,
  type BlogLength,
} from "@/types/domain";

const STEPS_KO = [
  "주제를 분석하는 중...",
  "구성을 잡는 중...",
  "글을 쓰는 중...",
  "SEO를 다듬는 중...",
  "커버 이미지를 만드는 중...",
];

const STEPS_EN = [
  "Analyzing the topic...",
  "Outlining the post...",
  "Writing the post...",
  "Polishing SEO...",
  "Creating the cover image...",
];

const VOICE_STEPS_KO = [
  "녹음을 업로드하는 중...",
  "음성을 텍스트로 변환하는 중...",
  "핵심 내용을 정리하는 중...",
  "글을 쓰는 중...",
  "SEO를 다듬는 중...",
  "커버 이미지를 만드는 중...",
];

const VOICE_STEPS_EN = [
  "Uploading your recording...",
  "Transcribing your voice...",
  "Organizing the key points...",
  "Writing the post...",
  "Polishing SEO...",
  "Creating the cover image...",
];

const MAX_RECORD_SECONDS = 15 * 60;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/** 녹음 포맷 — mp4(AAC)가 호환성이 가장 좋고, 구형 브라우저는 webm으로. */
function pickRecordingMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

function extFromMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  return (
    {
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
      "audio/m4a": "m4a",
      "audio/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/ogg": "ogg",
      "audio/aac": "aac",
      "audio/flac": "flac",
    }[base] ?? "bin"
  );
}

/** 확장자로 MIME 추정 — 일부 기기에서 File.type이 비어 있는 m4a 대응. */
function mimeFromName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  return (
    {
      m4a: "audio/mp4",
      mp4: "audio/mp4",
      webm: "audio/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      aac: "audio/aac",
      flac: "audio/flac",
    }[ext ?? ""] ?? null
  );
}

const subscribeNoop = () => () => {};
const getCanRecord = () =>
  typeof MediaRecorder !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;
const getCanRecordServer = () => false;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function BlogComposer({ businessId }: { businessId: string }) {
  const router = useRouter();
  const ko = useLocale() === "ko";
  const [mode, setMode] = useState<"topic" | "voice">("topic");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<BlogTone>("Friendly");
  const [length, setLength] = useState<BlogLength>("Medium");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 음성 입력 상태 ──
  // SSR에서는 false, 클라이언트에서 브라우저 지원 여부로 확정 (hydration 안전)
  const canRecord = useSyncExternalStore(
    subscribeNoop,
    getCanRecord,
    getCanRecordServer,
  );
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<{
    blob: Blob;
    mime: string;
    label: string;
    url: string;
  } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      // 언마운트 시 녹음/타이머 정리
      if (timerRef.current) clearInterval(timerRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stream.getTracks().forEach((t) => t.stop());
        rec.stop();
      }
    };
  }, []);

  const clearAudio = () => {
    if (audio) URL.revokeObjectURL(audio.url);
    setAudio(null);
    setSeconds(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const setAudioBlob = (blob: Blob, mime: string, label: string) => {
    if (audio) URL.revokeObjectURL(audio.url);
    setAudio({ blob, mime, label, url: URL.createObjectURL(blob) });
  };

  const startRecording = async () => {
    setError(null);
    clearAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecordingMime();
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > 0)
          setAudioBlob(blob, type, ko ? "방금 녹음한 내용" : "Your recording");
      };
      recorderRef.current = rec;
      rec.start(1000);
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError(
        ko
          ? "마이크를 사용할 수 없습니다. 브라우저에서 마이크 권한을 허용하거나, 녹음 파일을 업로드해주세요."
          : "Microphone unavailable. Allow mic access in your browser, or upload a recording file.",
      );
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const mime = file.type || mimeFromName(file.name);
    if (!mime || !mime.startsWith("audio/")) {
      setError(
        ko
          ? "오디오 파일만 업로드할 수 있습니다. (m4a/mp3/wav 등)"
          : "Please upload an audio file. (m4a/mp3/wav, etc.)",
      );
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError(
        ko
          ? "녹음 파일은 20MB 이하여야 합니다. (약 15분 이내)"
          : "Recordings must be 20MB or smaller (about 15 minutes).",
      );
      return;
    }
    setSeconds(0);
    setAudioBlob(file, mime, file.name);
  };

  const generate = async () => {
    if (mode === "topic" && !topic.trim()) {
      setError(
        ko
          ? "어떤 내용을 쓰고 싶은지 알려주세요."
          : "Tell us what you would like to write about.",
      );
      return;
    }
    if (mode === "voice") {
      if (recording) stopRecording();
      if (!audio) {
        setError(
          ko
            ? "먼저 녹음하거나 음성 파일을 올려주세요."
            : "Record or upload a voice file first.",
        );
        return;
      }
      if (audio.blob.size > MAX_AUDIO_BYTES) {
        setError(
          ko
            ? "녹음 파일은 20MB 이하여야 합니다."
            : "Recordings must be 20MB or smaller.",
        );
        return;
      }
    }
    setError(null);
    setGenerating(true);
    try {
      let res: Response;
      if (mode === "topic") {
        res = await fetch("/api/ai/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, topic, tone, length }),
        });
      } else {
        // 1) 서명 URL 발급 → 2) Storage 직접 업로드 → 3) 경로만 서버로
        const ticket = await createVoiceUploadUrl(
          businessId,
          extFromMime(audio!.mime),
        );
        if (ticket.error || !ticket.path || !ticket.token)
          throw new Error(
            ticket.error ??
              (ko ? "업로드 준비에 실패했습니다." : "Failed to prepare upload."),
          );
        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from("voice-notes")
          .uploadToSignedUrl(ticket.path, ticket.token, audio!.blob, {
            contentType: audio!.mime,
          });
        if (upErr)
          throw new Error(
            ko
              ? "녹음 업로드에 실패했습니다. 다시 시도해주세요."
              : "Failed to upload the recording. Please try again.",
          );
        res = await fetch("/api/ai/blog-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            storagePath: ticket.path,
            mimeType: audio!.mime,
            tone,
            length,
          }),
        });
      }
      const json = await res.json();
      if (!res.ok)
        throw new Error(
          json.error ?? (ko ? "생성에 실패했습니다." : "Generation failed."),
        );
      router.push(`/business/${businessId}/blog/${json.postId}`);
    } catch (e) {
      setGenerating(false);
      setError(
        e instanceof Error
          ? e.message
          : ko
            ? "생성에 실패했습니다."
            : "Generation failed.",
      );
    }
  };

  if (generating && !error) {
    return (
      <GeneratingScreen
        title={ko ? "블로그 글을 쓰고 있어요..." : "Writing your blog post..."}
        steps={
          mode === "voice"
            ? ko
              ? VOICE_STEPS_KO
              : VOICE_STEPS_EN
            : ko
              ? STEPS_KO
              : STEPS_EN
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko
            ? "어떤 이야기를 나누고 싶으세요?"
            : "What story would you like to share?"}
        </h1>
        <p className="mt-1 text-muted">
          {ko
            ? "주제를 적거나, 말로 설명하면 AI가 블로그 글로 만들어드립니다."
            : "Type a topic or just talk — AI will turn it into a blog post."}
        </p>
      </div>

      {/* 입력 모드 탭 */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface p-1">
        {(
          [
            { key: "topic", label: ko ? "주제로 작성" : "From a topic", icon: Icon.pen },
            { key: "voice", label: ko ? "음성으로 작성" : "From your voice", icon: Icon.mic },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setMode(tab.key);
              setError(null);
            }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              mode === tab.key
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            <tab.icon width={16} height={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="space-y-5">
        {mode === "topic" ? (
          <div>
            <Label htmlFor="topic">{ko ? "주제" : "Topic"}</Label>
            <Textarea
              id="topic"
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                ko
                  ? "예: 오늘 새로 출시한 딸기 케이크에 대해 홍보하고 싶어요."
                  : "e.g. I want to promote the strawberry cake we launched today."
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Label>{ko ? "음성 녹음" : "Voice recording"}</Label>
            <p className="text-sm text-muted">
              {ko
                ? "글로 쓰기 어려우면 말로 편하게 설명해주세요. 녹음한 내용을 AI가 듣고 블로그 글로 다듬어드립니다. (최대 15분 / 20MB)"
                : "If writing is hard, just talk. AI listens to your recording and turns it into a polished blog post. (max 15 min / 20MB)"}
            </p>

            {audio ? (
              <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                <p className="truncate text-sm font-medium">{audio.label}</p>
                <audio controls src={audio.url} className="w-full" />
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>
                    {seconds > 0 && `${fmtTime(seconds)} · `}
                    {(audio.blob.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                  <button
                    type="button"
                    onClick={clearAudio}
                    className="font-medium text-primary hover:underline"
                  >
                    {ko ? "다시 녹음 / 파일 변경" : "Re-record / change file"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface p-6">
                {canRecord && (
                  <>
                    <button
                      type="button"
                      onClick={recording ? stopRecording : startRecording}
                      className={cn(
                        "flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md transition",
                        recording
                          ? "animate-pulse bg-danger"
                          : "bg-primary hover:opacity-90",
                      )}
                      aria-label={
                        recording
                          ? ko
                            ? "녹음 중지"
                            : "Stop recording"
                          : ko
                            ? "녹음 시작"
                            : "Start recording"
                      }
                    >
                      {recording ? (
                        <span className="block h-5 w-5 rounded-sm bg-white" />
                      ) : (
                        <Icon.mic width={28} height={28} />
                      )}
                    </button>
                    <p className="text-sm font-medium">
                      {recording
                        ? `${fmtTime(seconds)} — ${ko ? "말씀하세요. 끝나면 버튼을 눌러주세요." : "Speak now. Tap to stop."}`
                        : ko
                          ? "버튼을 누르고 말씀하세요"
                          : "Tap and start talking"}
                    </p>
                  </>
                )}
                {!recording && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.aac"
                      className="hidden"
                      onChange={onFileChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {ko
                        ? "또는 녹음 파일 올리기 (m4a/mp3/wav)"
                        : "or upload a recording (m4a/mp3/wav)"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tone">{ko ? "톤" : "Tone"}</Label>
            <Select
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value as BlogTone)}
            >
              {BLOG_TONES.map((t) => (
                <option key={t} value={t}>
                  {ko ? BLOG_TONE_LABEL[t] : t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="length">{ko ? "분량" : "Length"}</Label>
            <Select
              id="length"
              value={length}
              onChange={(e) => setLength(e.target.value as BlogLength)}
            >
              {BLOG_LENGTHS.map((l) => (
                <option key={l} value={l}>
                  {ko ? BLOG_LENGTH_LABEL[l] : l}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={generate} className="w-full" disabled={recording}>
          <Icon.sparkles width={18} height={18} />
          {ko ? "글 생성하기" : "Generate post"}
        </Button>
      </Card>
    </div>
  );
}
