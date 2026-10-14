"use client";

import { useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { reserveShortsQuota } from "@/app/business/actions";
import type { PlanId } from "@/lib/plans";
import {
  createMusicBed,
  createCustomBed,
  SHORTS_MOODS,
  type ShortsMood,
} from "@/lib/shorts/music";

/** 음악 선택 — 합성 분위기 또는 '내 음악 올리기'(custom). */
type MusicChoice = ShortsMood | "custom";
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB
import {
  renderShortsVideo,
  fileToImage,
  type ShortsMotion,
} from "@/lib/shorts/render";

export interface ShortsQuota {
  planId: PlanId;
  limit: number | null;
  used: number;
}

type SizeId = "youtube" | "tiktok";
const SIZES: { id: SizeId; ko: string; en: string; w: number; h: number }[] = [
  { id: "youtube", ko: "유튜브 쇼츠", en: "YouTube Shorts", w: 1080, h: 1920 },
  { id: "tiktok", ko: "틱톡·릴스", en: "TikTok / Reels", w: 1080, h: 1920 },
];

const MOTIONS: { id: ShortsMotion; ko: string; en: string; desc: string }[] = [
  { id: "static", ko: "정적인", en: "Calm", desc: "천천히 줌·부드러운 전환" },
  { id: "dynamic", ko: "다이내믹", en: "Dynamic", desc: "빠른 슬라이드·줌" },
];

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * 카드뉴스를 배경으로 쇼츠(9:16) 영상을 브라우저에서 만들어 저장한다.
 * - 실제 동영상이 아니라 카드 이미지 슬라이드 + 합성 음악(무저작권) → 패킷 최소.
 * - 정적/다이내믹 모션, 유튜브/틱톡 사이즈 선택. BASIC·Pro 전용(월 30/90회).
 */
export function ShortsPanel({
  businessId,
  slugName,
  cardCount,
  renderCards,
  guard,
  quota,
}: {
  businessId: string;
  slugName: () => string;
  cardCount: number;
  /** 현재 카드들을 PNG로 렌더(카드뉴스의 renderCardFiles 재사용). */
  renderCards: () => Promise<File[]>;
  /** 배경 누락 경고(guardMissing). 진행 가능하면 true. */
  guard: () => boolean;
  quota: ShortsQuota | null;
}) {
  const ko = useLocale() === "ko";
  const [size, setSize] = useState<SizeId>("youtube");
  const [motion, setMotion] = useState<ShortsMotion>("static");
  const [music, setMusic] = useState<MusicChoice>("bright");
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [used, setUsed] = useState(quota?.used ?? 0);

  const planId = quota?.planId ?? "free";
  const limit = quota?.limit ?? 0;
  const planOk = planId !== "free" && limit !== 0;
  const limitReached = limit !== null && used >= limit;

  const make = async () => {
    if (busy) return;
    setError(null);
    setMsg(null);
    if (!planOk) {
      setError(
        ko
          ? "쇼츠 만들기는 BASIC·Pro 플랜에서 사용할 수 있어요."
          : "Shorts are available on the BASIC and Pro plans.",
      );
      return;
    }
    if (limitReached) {
      setError(
        ko
          ? `이번 달 쇼츠 ${limit}회를 모두 사용했어요.`
          : `You've used all ${limit} shorts this month.`,
      );
      return;
    }
    if (music === "custom") {
      if (!customFile) {
        setError(ko ? "사용할 음원 파일을 선택해주세요." : "Please choose an audio file.");
        return;
      }
      if (!consent) {
        setError(
          ko
            ? "업로드 음원의 저작권 책임 동의에 체크해주세요."
            : "Please agree to the copyright responsibility notice.",
        );
        return;
      }
    }
    if (!guard()) return;

    setBusy(true);
    setProgress(0);
    let imgs: HTMLImageElement[] = [];
    let AC: AudioContext | null = null;
    try {
      // 1) 서버에서 플랜·월한도 검증 + 사용 1건 기록(실제 영상은 로컬 생성).
      const q = await reserveShortsQuota(businessId);
      if (q.error) {
        setError(q.error);
        return;
      }
      if (typeof q.used === "number") setUsed(q.used);

      // 2) 현재 카드들을 이미지로 렌더
      const files = await renderCards();
      if (files.length === 0) throw new Error("no cards");
      imgs = await Promise.all(files.map((f) => fileToImage(f)));

      // 3) 음악 합성(선택) + 4) 영상 렌더
      const preset = SIZES.find((s) => s.id === size) ?? SIZES[0];
      const perCardMs = motion === "dynamic" ? 1800 : 3000;
      const totalSec = (imgs.length * perCardMs) / 1000;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      AC = new AudioCtx();
      await AC.resume().catch(() => {});
      let bed;
      if (music === "custom" && customFile) {
        const arr = await customFile.arrayBuffer();
        let buffer: AudioBuffer;
        try {
          buffer = await AC.decodeAudioData(arr);
        } catch {
          throw new Error("decode");
        }
        bed = createCustomBed(AC, buffer, totalSec);
      } else {
        bed = createMusicBed(AC, music === "custom" ? "none" : music, totalSec);
      }
      bed.start();

      const result = await renderShortsVideo(imgs, {
        width: preset.w,
        height: preset.h,
        perCardMs,
        transitionMs: motion === "dynamic" ? 380 : 600,
        motion,
        fps: 30,
        audioStream: bed.stream,
        onProgress: setProgress,
      });
      bed.stop();

      // 5) 저장
      saveBlob(result.blob, `${slugName()}-shorts.${result.ext}`);
      setMsg(
        ko
          ? "쇼츠를 저장했어요! 유튜브 쇼츠·틱톡·릴스에 올려보세요."
          : "Saved! Upload it to YouTube Shorts, TikTok, or Reels.",
      );
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(
        code === "no cards"
          ? ko
            ? "카드가 없어요. 먼저 카드뉴스를 만들어주세요."
            : "No cards yet. Create card news first."
          : code === "decode"
            ? ko
              ? "음원 파일을 읽을 수 없어요. mp3·m4a·wav 형식의 다른 파일로 시도해주세요."
              : "Could not read the audio file. Try another mp3/m4a/wav file."
            : ko
              ? "쇼츠를 만드는 중 문제가 발생했어요. 다시 시도해주세요."
              : "Something went wrong while making the shorts. Please try again.",
      );
    } finally {
      imgs.forEach((im) => {
        try {
          URL.revokeObjectURL(im.src);
        } catch {
          /* noop */
        }
      });
      if (AC) AC.close().catch(() => {});
      setBusy(false);
      setProgress(0);
    }
  };

  const remainLabel =
    limit === null
      ? ko
        ? "무제한"
        : "Unlimited"
      : ko
        ? `이번 달 ${used}/${limit}회 사용`
        : `${used}/${limit} used this month`;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <FilmIcon />
          {ko ? "쇼츠 만들기 (9:16)" : "Make a Short (9:16)"}
        </span>
        {planOk ? (
          <span className="text-xs text-muted">{remainLabel}</span>
        ) : (
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
            BASIC · Pro
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        {ko
          ? "지금 카드뉴스를 배경으로, 무료 음악과 이미지 슬라이드로 9:16 쇼츠 영상을 만들어 저장해요. (유튜브 쇼츠·틱톡·릴스용)"
          : "Turn these cards into a 9:16 short with free music and image slides, saved to your device. (For YouTube Shorts, TikTok, Reels)"}
      </p>

      {planOk ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {/* 사이즈 */}
            <Field label={ko ? "사이즈" : "Size"}>
              <div className="flex flex-wrap gap-1.5">
                {SIZES.map((s) => (
                  <Chip
                    key={s.id}
                    active={size === s.id}
                    onClick={() => setSize(s.id)}
                    disabled={busy}
                  >
                    {ko ? s.ko : s.en}
                  </Chip>
                ))}
              </div>
            </Field>
            {/* 모션 */}
            <Field label={ko ? "움직임" : "Motion"}>
              <div className="flex flex-wrap gap-1.5">
                {MOTIONS.map((m) => (
                  <Chip
                    key={m.id}
                    active={motion === m.id}
                    onClick={() => setMotion(m.id)}
                    disabled={busy}
                  >
                    {ko ? m.ko : m.en}
                  </Chip>
                ))}
              </div>
            </Field>
            {/* 음악 */}
            <Field label={ko ? "배경 음악" : "Music"}>
              <div className="flex flex-wrap gap-1.5">
                {SHORTS_MOODS.map((m) => (
                  <Chip
                    key={m.id}
                    active={music === m.id}
                    onClick={() => setMusic(m.id)}
                    disabled={busy}
                  >
                    {ko ? m.ko : m.en}
                  </Chip>
                ))}
                <Chip
                  active={music === "custom"}
                  onClick={() => setMusic("custom")}
                  disabled={busy}
                >
                  {ko ? "내 음악 올리기" : "Upload music"}
                </Chip>
              </div>
            </Field>
          </div>

          {/* 내 음악 업로드 + 저작권 책임 동의 */}
          {music === "custom" && (
            <div className="mt-3 rounded-xl border border-border bg-surface-muted/50 p-3">
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setError(null);
                  if (!f) return;
                  if (f.size > MAX_AUDIO_BYTES) {
                    setError(
                      ko
                        ? "음원은 20MB 이하만 올릴 수 있어요."
                        : "Audio files must be 20MB or smaller.",
                    );
                    return;
                  }
                  setCustomFile(f);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  {ko ? "음원 파일 선택" : "Choose audio file"}
                </Button>
                <span className="text-xs text-muted">
                  {customFile
                    ? customFile.name
                    : ko
                      ? "mp3·m4a·wav 등 (20MB 이하)"
                      : "mp3/m4a/wav (≤20MB)"}
                </span>
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={busy}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  {ko
                    ? "업로드하는 음원의 저작권 및 사용 권한에 대한 책임은 전적으로 본인에게 있으며, 이로 인한 분쟁의 책임이 STORYUP에 없음에 동의합니다."
                    : "I confirm I have the rights to use this audio and take full responsibility for any copyright claims; STORYUP is not liable."}
                </span>
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={make}
              disabled={
                busy ||
                limitReached ||
                (music === "custom" && (!customFile || !consent))
              }
            >
              {busy ? (
                <>
                  <Spinner className="size-4" />
                  {ko
                    ? `만드는 중... ${Math.round(progress * 100)}%`
                    : `Rendering... ${Math.round(progress * 100)}%`}
                </>
              ) : (
                <>
                  <FilmIcon />
                  {ko ? "쇼츠 만들기" : "Make Short"}
                </>
              )}
            </Button>
            <span className="text-xs text-muted">
              {ko
                ? `카드 ${cardCount}장 · 약 ${Math.round((cardCount * (motion === "dynamic" ? 1.8 : 3)) )}초`
                : `${cardCount} cards · ~${Math.round(cardCount * (motion === "dynamic" ? 1.8 : 3))}s`}
            </span>
          </div>
          {busy && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {ko
              ? "브라우저에서 바로 만들어요. 만드는 동안 탭을 닫지 말아주세요. (mp4를 지원하지 않는 브라우저는 webm으로 저장됩니다)"
              : "Made right in your browser — keep this tab open while rendering. (Browsers without mp4 support save as webm.)"}
          </p>
        </>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            {ko
              ? "쇼츠 만들기는 BASIC·Pro 플랜 전용이에요."
              : "Shorts are a BASIC / Pro feature."}
          </p>
          <ButtonLink href="/pricing" variant="outline" size="sm">
            {ko ? "플랜 보기" : "See plans"}
          </ButtonLink>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-foreground hover:border-primary/50")
      }
    >
      {children}
    </button>
  );
}

function FilmIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M2 9h5M2 15h5M17 9h5M17 15h5" />
    </svg>
  );
}
