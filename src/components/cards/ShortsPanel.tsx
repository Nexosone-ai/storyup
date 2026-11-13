"use client";

import { useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { reserveShortsQuota } from "@/app/business/actions";
import {
  createEditedVideoUploadUrl,
  registerEditedVideo,
} from "@/app/business/[id]/video/actions";
import { createClient } from "@/lib/supabase/client";
import { uploadShortToYoutube } from "@/lib/shorts/youtubeUpload";
import type { PlanId } from "@/lib/plans";
import { upsellSentence } from "@/lib/upsell";
import {
  createMusicBed,
  createCustomBed,
  SHORTS_MOODS,
  type ShortsMood,
} from "@/lib/shorts/music";
import { BgmPreview } from "@/components/shorts/BgmPreview";

/** 음악 선택 — 합성 분위기 / 라이브러리(library) / 내 음악 올리기(custom). */
type MusicChoice = ShortsMood | "library" | "custom";
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB

/** 간단 편집용 카드 — 썸네일·포함여부·노출시간(ms). */
type EditCard = {
  id: string;
  file: File;
  url: string;
  include: boolean;
  durationMs: number;
};
import {
  renderShortsVideo,
  fileToImage,
  type ShortsMotion,
} from "@/lib/shorts/render";
import { SHORTS_ENABLED } from "@/lib/shorts/config";
import { BGM_TRACKS, BGM_AVAILABLE } from "@/lib/shorts/bgm";

export interface ShortsQuota {
  planId: PlanId;
  limit: number | null;
  used: number;
}

export interface ShortsYoutube {
  /** OAuth 자격증명이 서버에 설정됨(미설정이면 '준비중'). */
  configured: boolean;
  /** 이 사용자가 유튜브 계정을 연결함. */
  connected: boolean;
  channelTitle: string | null;
  /** Pro/Partner — 업로드 사용 가능. */
  canUse: boolean;
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
  youtube,
  title,
  view,
  onRendered,
  blobOverride,
}: {
  businessId: string;
  slugName: () => string;
  cardCount: number;
  /** 현재 카드들을 PNG로 렌더(카드뉴스의 renderCardFiles 재사용). */
  renderCards: () => Promise<File[]>;
  /** 배경 누락 경고(guardMissing). 진행 가능하면 true. */
  guard: () => boolean;
  quota: ShortsQuota | null;
  youtube?: ShortsYoutube | null;
  /** 유튜브 업로드 제목 기본값(카드 표지 제목). */
  title?: string;
  /** (허브용) 'make' = 설정·편집·만들기만, 'share' = 다운로드·유튜브만. 미지정 = 전부. */
  view?: "make" | "share";
  /** (허브용) 렌더 완료 시 결과 Blob 을 바깥에 넘긴다(편집 단계 입력). */
  onRendered?: (blob: Blob, ext: string) => void;
  /** (허브용) 편집본으로 교체 — 다운로드·유튜브 업로드에 이 Blob 을 쓴다. */
  blobOverride?: { blob: Blob; ext: string } | null;
}) {
  const ko = useLocale() === "ko";
  const [size, setSize] = useState<SizeId>("youtube");
  const [motion, setMotion] = useState<ShortsMotion>("static");
  const [music, setMusic] = useState<MusicChoice>("bright");
  // 음원 시작·끝 페이드 길이(초). 0=없음.
  const [fadeSec, setFadeSec] = useState<number>(1);
  const [libraryUrl, setLibraryUrl] = useState<string>(
    BGM_TRACKS[0]?.url ?? "",
  );
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [used, setUsed] = useState(quota?.used ?? 0);
  // 방금 만든 영상(유튜브 업로드용) + 업로드 상태. 편집본(blobOverride)이 있으면 그것을 우선 쓴다.
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [lastExt, setLastExt] = useState("mp4");
  // 내 페이지(공개 사이트 '영상') 저장 상태 — 렌더 직후 자동 저장, 실패 시 버튼으로 재시도.
  const [siteSave, setSiteSave] = useState<
    { state: "idle" } | { state: "saving" } | { state: "saved"; url: string } | { state: "failed"; error: string }
  >({ state: "idle" });

  /** 쇼츠를 Storage 에 직접 올리고 '내 영상'(공개 사이트 영상)으로 등록한다. */
  const saveToSite = async (blob: Blob, ext: string, label?: string) => {
    setSiteSave({ state: "saving" });
    try {
      const ticket = await createEditedVideoUploadUrl(businessId, ext, "shorts");
      if (ticket.error || !ticket.path || !ticket.token)
        throw new Error(ticket.error ?? (ko ? "업로드 준비에 실패했어요." : "Could not prepare upload."));
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(ticket.bucket ?? "site-videos")
        .uploadToSignedUrl(ticket.path, ticket.token, blob, {
          contentType: blob.type || (ext === "webm" ? "video/webm" : "video/mp4"),
        });
      if (upErr) throw new Error(ko ? "업로드에 실패했어요." : "Upload failed.");
      const reg = await registerEditedVideo(
        businessId,
        ticket.path,
        `${title?.trim() || slugName()}${label ? ` ${label}` : ""}`,
        "shorts",
      );
      if (reg.error || !reg.url) throw new Error(reg.error ?? "save failed");
      setSiteSave({ state: "saved", url: reg.url });
    } catch (e) {
      setSiteSave({
        state: "failed",
        error:
          e instanceof Error && e.message
            ? e.message
            : ko
              ? "내 페이지 저장에 실패했어요."
              : "Could not save to your page.",
      });
    }
  };
  const shareBlob = blobOverride?.blob ?? lastBlob;
  const shareExt = blobOverride?.ext ?? lastExt;
  const showMake = !view || view === "make";
  const showShare = !view || view === "share";
  const [ytBusy, setYtBusy] = useState(false);
  const [ytLink, setYtLink] = useState<string | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);

  // 간단 편집 — 카드별 포함/순서/노출시간 조율.
  const [editCards, setEditCards] = useState<EditCard[] | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const loadEdit = async () => {
    if (loadingEdit) return;
    setError(null);
    if (!guard()) return;
    setLoadingEdit(true);
    try {
      const files = await renderCards();
      if (files.length === 0) {
        setError(
          ko ? "카드가 없어요. 먼저 카드뉴스를 만들어주세요." : "No cards yet.",
        );
        return;
      }
      const d = motion === "dynamic" ? 1800 : 3000;
      // 이전 썸네일 URL 정리.
      editCards?.forEach((c) => URL.revokeObjectURL(c.url));
      setEditCards(
        files.map((f, i) => ({
          id: `${Date.now()}-${i}`,
          file: f,
          url: URL.createObjectURL(f),
          include: true,
          durationMs: d,
        })),
      );
    } catch {
      setError(ko ? "카드를 불러오지 못했어요." : "Could not load cards.");
    } finally {
      setLoadingEdit(false);
    }
  };
  const editMove = (i: number, dir: -1 | 1) =>
    setEditCards((list) => {
      if (!list) return list;
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const editToggle = (id: string) =>
    setEditCards((list) =>
      list
        ? list.map((c) => (c.id === id ? { ...c, include: !c.include } : c))
        : list,
    );
  const editDuration = (id: string, ms: number) =>
    setEditCards((list) =>
      list
        ? list.map((c) => (c.id === id ? { ...c, durationMs: ms } : c))
        : list,
    );

  const planId = quota?.planId ?? "free";
  // 한도 null = 무제한(Partner). `?? 0`로 받으면 null이 0(미제공)이 돼 파트너가 막히므로 null을 보존한다.
  const limit: number | null = quota ? quota.limit : 0;
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
          ? `이번 달 카드뉴스 영상 ${limit}편을 모두 사용했어요. ${upsellSentence(true)}`
          : `You've used all ${limit} shorts this month. ${upsellSentence(false)}`,
      );
      return;
    }
    if (music === "custom") {
      if (!customFile) {
        setError(
          ko
            ? "사용할 음원 파일을 선택해주세요."
            : "Please choose an audio file.",
        );
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

      // 2) 편집 목록(순서·포함·카드별 시간)이 있으면 그걸, 없으면 전체 카드를 균일 시간으로.
      let files: File[];
      let durations: number[];
      if (editCards && editCards.length > 0) {
        const chosen = editCards.filter((c) => c.include);
        if (chosen.length === 0) throw new Error("no cards");
        files = chosen.map((c) => c.file);
        durations = chosen.map((c) => c.durationMs);
      } else {
        files = await renderCards();
        if (files.length === 0) throw new Error("no cards");
        const d = motion === "dynamic" ? 1800 : 3000;
        durations = files.map(() => d);
      }
      imgs = await Promise.all(files.map((f) => fileToImage(f)));

      // 3) 음악 합성(선택) + 4) 영상 렌더
      const preset = SIZES.find((s) => s.id === size) ?? SIZES[0];
      const totalSec = durations.reduce((a, b) => a + b, 0) / 1000;

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
        bed = createCustomBed(AC, buffer, totalSec, fadeSec, fadeSec);
      } else if (music === "library" && libraryUrl) {
        // 라이브러리 곡을 받아 디코딩(custom과 같은 경로로 녹화 스트림에 합침).
        let buffer: AudioBuffer;
        try {
          const arr = await (await fetch(libraryUrl)).arrayBuffer();
          buffer = await AC.decodeAudioData(arr);
        } catch {
          throw new Error("decode");
        }
        bed = createCustomBed(AC, buffer, totalSec, fadeSec, fadeSec);
      } else {
        const mood = music === "custom" || music === "library" ? "none" : music;
        bed = createMusicBed(AC, mood, totalSec, fadeSec, fadeSec);
      }
      bed.start();

      const result = await renderShortsVideo(imgs, {
        width: preset.w,
        height: preset.h,
        durations,
        transitionMs: motion === "dynamic" ? 380 : 600,
        motion,
        fps: 30,
        audioStream: bed.stream,
        onProgress: setProgress,
      });
      bed.stop();

      // 5) 저장 + 유튜브 업로드용으로 보관(허브에도 전달 → 편집 단계 입력)
      saveBlob(result.blob, `${slugName()}-shorts.${result.ext}`);
      setLastBlob(result.blob);
      setLastExt(result.ext);
      onRendered?.(result.blob, result.ext);
      setYtLink(null);
      setYtError(null);
      setMsg(
        ko
          ? "쇼츠를 저장했어요! 유튜브 쇼츠·틱톡·릴스에 올려보세요."
          : "Saved! Upload it to YouTube Shorts, TikTok, or Reels.",
      );
      // 6) 내 페이지(공개 사이트 '영상')에도 저장 — 실패해도 쇼츠 자체는 완료.
      void saveToSite(result.blob, result.ext);
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

  /** 방금 만든 쇼츠를 유튜브에 직접 업로드(브라우저 → 유튜브, 서버 미경유). 공용 헬퍼 사용. */
  const uploadToYoutube = async () => {
    if (ytBusy || !shareBlob) return;
    setYtBusy(true);
    setYtError(null);
    setYtLink(null);
    const r = await uploadShortToYoutube(
      shareBlob,
      { title: title || slugName() || "StoryUp Shorts" },
      ko,
    );
    if (r.error) setYtError(r.error);
    else setYtLink(r.link ?? null);
    setYtBusy(false);
  };

  const remainLabel =
    limit === null
      ? ko
        ? "무제한"
        : "Unlimited"
      : ko
        ? `이번 달 ${used}/${limit}회 사용`
        : `${used}/${limit} used this month`;

  // 준비중 — 기능 비활성화(NEXT_PUBLIC_SHORTS_ENABLED=true로 활성화).
  if (!SHORTS_ENABLED) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <FilmIcon />
            {ko ? "쇼츠 만들기 (9:16)" : "Make a Short (9:16)"}
          </span>
          <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted">
            {ko ? "준비중" : "Coming soon"}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          {ko
            ? "쇼츠 동영상 만들기는 현재 준비 중이에요. 곧 제공될 예정입니다."
            : "Shorts video creation is coming soon."}
        </p>
      </div>
    );
  }

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
          {showMake && (
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
                  <div className="flex flex-wrap items-center gap-1.5">
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
                    {BGM_AVAILABLE && (
                      <Chip
                        active={music === "library"}
                        onClick={() => setMusic("library")}
                        disabled={busy}
                      >
                        {ko ? "음악 라이브러리" : "Music library"}
                      </Chip>
                    )}
                    <Chip
                      active={music === "custom"}
                      onClick={() => setMusic("custom")}
                      disabled={busy}
                    >
                      {ko ? "내 음악 올리기" : "Upload music"}
                    </Chip>
                    {SHORTS_MOODS.some((m) => m.id === music) && (
                      <BgmPreview
                        mood={music as ShortsMood}
                        disabled={busy}
                        ko={ko}
                      />
                    )}
                  </div>
                </Field>
              </div>

              {/* 음악 라이브러리 — 미리듣기 후 선택 */}
              {music === "library" && (
                <div className="mt-3 rounded-xl border border-border bg-surface-muted/50 p-3">
                  <p className="mb-2 text-xs text-muted">
                    {ko
                      ? "곡을 들어보고 하나를 선택하세요. 선택한 곡이 쇼츠 배경음악으로 들어가요."
                      : "Preview and pick one track for your short's background music."}
                  </p>
                  <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                    {BGM_TRACKS.map((t) => (
                      <li
                        key={t.id}
                        className={`flex items-center gap-2 rounded-lg border p-2 ${
                          libraryUrl === t.url
                            ? "border-primary bg-primary-soft/40"
                            : "border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name="bgm"
                          checked={libraryUrl === t.url}
                          onChange={() => setLibraryUrl(t.url)}
                          className="size-4 shrink-0 accent-[var(--primary)]"
                        />
                        <span className="w-24 shrink-0 text-sm font-medium">
                          {t.label}
                        </span>
                        <audio
                          controls
                          preload="none"
                          src={t.url}
                          className="h-8 min-w-0 flex-1"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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

              {/* 음원 페이드(시작·끝) — 없음/0.5/1/2초 */}
              {music !== "none" && (
                <div className="mt-3">
                  <Field
                    label={ko ? "음원 페이드 (시작·끝)" : "Audio fade (in·out)"}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { v: 0, ko: "없음", en: "None" },
                        { v: 0.5, ko: "0.5초", en: "0.5s" },
                        { v: 1, ko: "1초", en: "1s" },
                        { v: 2, ko: "2초", en: "2s" },
                      ].map((o) => (
                        <Chip
                          key={o.v}
                          active={fadeSec === o.v}
                          onClick={() => setFadeSec(o.v)}
                          disabled={busy}
                        >
                          {ko ? o.ko : o.en}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                    {ko
                      ? "음악이 시작에서 서서히 커지고 끝에서 서서히 작아져요."
                      : "Music fades in at the start and fades out at the end."}
                  </p>
                </div>
              )}

              {/* 시간 조율·간단 편집 — 카드별 순서·포함·노출시간 */}
              <div className="mt-4 rounded-xl border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {ko ? "시간 조율·편집" : "Timing & edit"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadEdit}
                    disabled={loadingEdit || busy}
                  >
                    {loadingEdit ? (
                      <Spinner className="size-4" />
                    ) : editCards ? (
                      ko ? (
                        "카드 다시 불러오기"
                      ) : (
                        "Reload cards"
                      )
                    ) : ko ? (
                      "카드 불러와 편집"
                    ) : (
                      "Load cards"
                    )}
                  </Button>
                </div>
                {editCards && editCards.length > 0 ? (
                  <>
                    <ul className="mt-3 space-y-2">
                      {editCards.map((c, i) => (
                        <li
                          key={c.id}
                          className={`flex items-center gap-3 rounded-lg border border-border p-2 ${c.include ? "" : "opacity-50"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 썸네일 */}
                          <img
                            src={c.url}
                            alt=""
                            className="h-16 w-9 shrink-0 rounded border border-border object-cover"
                          />
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={c.include}
                              onChange={() => editToggle(c.id)}
                              className="size-4 accent-[var(--primary)]"
                            />
                            {ko ? "포함" : "On"}
                          </label>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-xs text-muted">
                              <span>{ko ? "노출 시간" : "Duration"}</span>
                              <span>{(c.durationMs / 1000).toFixed(1)}s</span>
                            </div>
                            <input
                              type="range"
                              min={1000}
                              max={6000}
                              step={250}
                              value={c.durationMs}
                              onChange={(e) =>
                                editDuration(c.id, Number(e.target.value))
                              }
                              disabled={!c.include}
                              className="w-full accent-[var(--primary)]"
                            />
                          </div>
                          <div className="flex shrink-0 flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => editMove(i, -1)}
                              disabled={i === 0}
                              className="rounded border border-border px-1.5 text-xs text-muted hover:text-primary disabled:opacity-40"
                              aria-label={ko ? "위로" : "Up"}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => editMove(i, 1)}
                              disabled={i === editCards.length - 1}
                              className="rounded border border-border px-1.5 text-xs text-muted hover:text-primary disabled:opacity-40"
                              aria-label={ko ? "아래로" : "Down"}
                            >
                              ↓
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted">
                      {(() => {
                        const inc = editCards.filter((c) => c.include);
                        const sec =
                          inc.reduce((a, c) => a + c.durationMs, 0) / 1000;
                        return ko
                          ? `포함 ${inc.length}장 · 총 약 ${sec.toFixed(1)}초`
                          : `${inc.length} cards · ~${sec.toFixed(1)}s`;
                      })()}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    {ko
                      ? "카드를 불러오면 순서 변경·포함 선택·카드별 노출 시간을 조절할 수 있어요. 불러오지 않으면 전체 카드를 기본 시간으로 만듭니다."
                      : "Load cards to reorder, toggle, and set per-card duration. Otherwise all cards use the default timing."}
                  </p>
                )}
              </div>

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
                    ? `카드 ${cardCount}장 · 약 ${Math.round(cardCount * (motion === "dynamic" ? 1.8 : 3))}초`
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
              {siteSave.state !== "idle" && (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {siteSave.state === "saving" && (
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <Spinner className="size-3.5" />
                      {ko ? "내 페이지에 저장하는 중…" : "Saving to your page…"}
                    </span>
                  )}
                  {siteSave.state === "saved" && (
                    <span className="font-medium text-primary">
                      {ko
                        ? "내 페이지(사이트 '영상')에도 저장했어요. 콘텐츠 스튜디오 6단계 '내 영상'에서 숨기거나 지울 수 있어요."
                        : "Also saved to your site's Videos. Manage it under My videos (step 6)."}
                    </span>
                  )}
                  {siteSave.state === "failed" && (
                    <>
                      <span className="text-danger">{siteSave.error}</span>
                      {lastBlob && (
                        <button
                          type="button"
                          onClick={() => saveToSite(lastBlob, lastExt)}
                          className="font-medium text-primary underline underline-offset-2"
                        >
                          {ko ? "내 페이지에 다시 저장" : "Retry save"}
                        </button>
                      )}
                    </>
                  )}
                </p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                {ko
                  ? "브라우저에서 바로 만들어요. 만드는 동안 탭을 닫지 말아주세요. (mp4를 지원하지 않는 브라우저는 webm으로 저장됩니다)"
                  : "Made right in your browser — keep this tab open while rendering. (Browsers without mp4 support save as webm.)"}
              </p>
            </>
          )}

          {showShare && (
            <>
              {/* 공유 전용 뷰: 만든(또는 편집한) 쇼츠 다시 받기 */}
              {view === "share" && (
                <>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!shareBlob}
                    onClick={() =>
                      shareBlob &&
                      saveBlob(shareBlob, `${slugName()}-shorts.${shareExt}`)
                    }
                  >
                    <FilmIcon />
                    {ko ? "쇼츠 다운로드" : "Download short"}
                    {blobOverride ? (ko ? " (편집본)" : " (edited)") : ""}
                  </Button>
                  {blobOverride && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={siteSave.state === "saving"}
                      onClick={() =>
                        saveToSite(blobOverride.blob, blobOverride.ext, ko ? "(편집본)" : "(edited)")
                      }
                    >
                      {siteSave.state === "saving" ? (
                        <Spinner className="size-4" />
                      ) : null}
                      {ko ? "편집본을 내 페이지에 저장" : "Save edited to my page"}
                    </Button>
                  )}
                  <span className="text-xs text-muted">
                    {shareBlob
                      ? ko
                        ? "유튜브 쇼츠·틱톡·릴스에 올려보세요."
                        : "Upload to YouTube Shorts, TikTok, or Reels."
                      : ko
                        ? "먼저 '쇼츠 만들기' 단계에서 영상을 만들어주세요."
                        : "Make a short first."}
                  </span>
                </div>
                {view === "share" && siteSave.state === "saved" && (
                  <p className="mt-2 text-xs font-medium text-primary">
                    {ko ? "내 페이지(사이트 '영상')에 저장했어요." : "Saved to your site's Videos."}
                  </p>
                )}
                {view === "share" && siteSave.state === "failed" && (
                  <p className="mt-2 text-xs text-danger">{siteSave.error}</p>
                )}
                </>
              )}

              {/* 유튜브 자동 업로드 (Pro + 구글 연결) */}
              {youtube?.canUse && youtube.configured && (
                <div className="mt-4 rounded-xl border border-border bg-surface-muted/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <YtIcon />
                      {ko ? "유튜브에 올리기" : "Upload to YouTube"}
                    </span>
                    {youtube.connected ? (
                      <span className="text-xs text-muted">
                        {ko ? "연결됨" : "Connected"}
                        {youtube.channelTitle
                          ? ` · ${youtube.channelTitle}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                  {youtube.connected ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={uploadToYoutube}
                        disabled={ytBusy || !shareBlob}
                      >
                        {ytBusy ? (
                          <>
                            <Spinner className="size-4" />
                            {ko ? "업로드 중..." : "Uploading..."}
                          </>
                        ) : ko ? (
                          "방금 만든 쇼츠 올리기"
                        ) : (
                          "Upload the latest short"
                        )}
                      </Button>
                      <span className="text-xs text-muted">
                        {shareBlob
                          ? ko
                            ? "비공개(private)로 올라가요. 유튜브에서 공개로 바꿀 수 있어요."
                            : "Uploads as private; make it public on YouTube."
                          : ko
                            ? "먼저 쇼츠를 만들어주세요."
                            : "Make a short first."}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <a
                        href={`/api/youtube/connect?next=${encodeURIComponent(
                          `/business/${businessId}/marketing?step=5`,
                        )}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        <YtIcon />
                        {ko
                          ? "구글 계정(유튜브) 연결"
                          : "Connect Google (YouTube)"}
                      </a>
                      <span className="text-xs text-muted">
                        {ko
                          ? "연결하면 만든 쇼츠를 내 유튜브 채널에 바로 올릴 수 있어요."
                          : "Connect to upload shorts straight to your channel."}
                      </span>
                    </div>
                  )}
                  {ytLink && (
                    <p className="mt-2 text-sm text-primary">
                      {ko ? "업로드 완료! " : "Uploaded! "}
                      <a
                        href={ytLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {ytLink}
                      </a>
                    </p>
                  )}
                  {ytError && (
                    <p className="mt-2 text-sm text-danger">{ytError}</p>
                  )}
                </div>
              )}
              {youtube?.canUse && !youtube.configured && (
                <p className="mt-3 text-[11px] text-muted">
                  {ko
                    ? "유튜브 자동 업로드는 준비 중입니다 (관리자 연동 후 활성화)."
                    : "YouTube auto-upload is being set up."}
                </p>
              )}
            </>
          )}
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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

function YtIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M23 7.5a3 3 0 0 0-2.1-2.1C19 4.9 12 4.9 12 4.9s-7 0-8.9.5A3 3 0 0 0 1 7.5 31 31 0 0 0 .6 12 31 31 0 0 0 1 16.5a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5A3 3 0 0 0 23 16.5 31 31 0 0 0 23.4 12 31 31 0 0 0 23 7.5zM9.8 15.3V8.7l5.7 3.3z"
      />
    </svg>
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
