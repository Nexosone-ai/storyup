"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { reserveShortsQuota } from "@/app/business/actions";
import type { PlanId } from "@/lib/plans";
import {
  createMusicBed,
  SHORTS_MOODS,
  type ShortsMood,
} from "@/lib/shorts/music";
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
  const [mood, setMood] = useState<ShortsMood>("bright");
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
      const bed = createMusicBed(AC, mood, totalSec);
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
      setError(
        e instanceof Error && e.message === "no cards"
          ? ko
            ? "카드가 없어요. 먼저 카드뉴스를 만들어주세요."
            : "No cards yet. Create card news first."
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
                    active={mood === m.id}
                    onClick={() => setMood(m.id)}
                    disabled={busy}
                  >
                    {ko ? m.ko : m.en}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={make} disabled={busy || limitReached}>
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
