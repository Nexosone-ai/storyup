"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Textarea, Select, Label } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { CARD_FONTS } from "@/components/cards/cardTheme";
import { RECAP_VOICES, type RecapScene } from "@/lib/recapShorts/config";
import { SHORTS_MOODS, createMusicBed, createCustomBed } from "@/lib/shorts/music";
import { BGM_TRACKS, BGM_AVAILABLE } from "@/lib/shorts/bgm";
import { renderShortsVideo, urlToImage } from "@/lib/shorts/render";
import { createMixBus, createNarrationTrack } from "@/lib/shorts/narration";
import { canvasFontForCard, ensureCanvasFont } from "@/lib/shorts/fonts";
import { uploadShortToYoutube } from "@/lib/shorts/youtubeUpload";
import {
  listRecapPostsAction,
  createRecapJobAction,
  synthRecapAudioAction,
  generateRecapSceneImageAction,
  updateRecapSceneAction,
  finalizeRecapJobAction,
  deleteRecapJobAction,
} from "@/app/partner/recap-shorts/actions";
import type { RecapCandidatePost } from "@/lib/recapShorts/jobs";

export interface RecapJobView {
  id: string;
  title: string;
  status: string;
  voice: string;
  imageSource: "cardnews" | "ai";
  font: string;
  bgm: string;
  scenes: RecapScene[];
  creditsCharged: number;
  videoUrl: string | null;
  businessName: string | null;
  createdAt: string;
}

// 상태 라벨 = '다음에 눌러야 할 단계'. 백그라운드 자동 처리는 없으므로 '진행 중' 같은 표현은 쓰지 않는다.
const STATUS_LABEL: Record<string, string> = {
  script: "다음: 내레이션 만들기",
  audio: "다음: 내레이션 만들기",
  images: "다음: AI 이미지 만들기",
  ready: "영상 만들기 가능",
  failed: "실패",
};

/** 장면 사이 여백(ms)·최소 장면 길이(ms). */
const SCENE_PAD_MS = 400;
const SCENE_MIN_MS = 1500;
/** 내레이션이 장면 시작보다 살짝 늦게 들어가도록(초). */
const NARRATION_LEAD_SEC = 0.1;

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

export function RecapShortsStudio(props: {
  businesses: { id: string; name: string }[];
  jobs: RecapJobView[];
  credits: number;
  basePrice: number | null;
  imagePrice: number | null;
  providers: { script: boolean; tts: boolean };
  youtube: { configured: boolean; connected: boolean; channelTitle: string | null };
}) {
  const { providers } = props;
  const configured = providers.script && providers.tts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">파트너 대행</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            블로그 요약 쇼츠
          </h1>
          <p className="mt-1.5 text-muted">
            고객의 발행 블로그 글 하나를 30~40초 내레이션 쇼츠로 만듭니다 — 대본(AI) →
            음성(TTS) → 이미지 → 자막·음악까지 브라우저에서 바로 영상으로.
          </p>
        </div>
        <div className="flex gap-3">
          <Card className="px-4 py-3 text-right">
            <p className="text-xs text-muted">보유 패킷</p>
            <p className="text-2xl font-semibold tabular-nums">
              {props.credits.toLocaleString()}
            </p>
          </Card>
          <ButtonLink href="/partner" variant="outline" size="sm">
            ← 파트너 홈
          </ButtonLink>
        </div>
      </div>

      {!configured && (
        <Card className="p-4">
          <p className="text-sm text-danger">
            {!providers.script && "대본 엔진(ANTHROPIC_API_KEY)이 설정되지 않았어요. "}
            {!providers.tts && "음성 합성(GEMINI_API_KEY)이 설정되지 않았어요. "}
            관리자에게 문의하세요.
          </p>
        </Card>
      )}

      <CreateForm
        businesses={props.businesses}
        credits={props.credits}
        basePrice={props.basePrice}
        imagePrice={props.imagePrice}
        disabled={!configured}
      />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">내 작업</h2>
        {props.jobs.length === 0 ? (
          <Card className="p-8">
            <p className="text-sm text-muted">아직 만든 요약 쇼츠가 없습니다.</p>
          </Card>
        ) : (
          props.jobs.map((j) => (
            <JobCard key={j.id} job={j} youtube={props.youtube} imagePrice={props.imagePrice} />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------- 만들기 폼 ----------------
function CreateForm({
  businesses,
  credits,
  basePrice,
  imagePrice,
  disabled,
}: {
  businesses: { id: string; name: string }[];
  credits: number;
  basePrice: number | null;
  imagePrice: number | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const [bizId, setBizId] = useState(businesses[0]?.id ?? "");
  const [posts, setPosts] = useState<RecapCandidatePost[]>([]);
  // 초기 사업장이 있으면 마운트 직후 글 목록을 불러오므로 로딩 상태로 시작.
  const [loadingPosts, setLoadingPosts] = useState(businesses.length > 0);
  const [postId, setPostId] = useState("");
  const [voice, setVoice] = useState(RECAP_VOICES[0].id);
  const [imageSource, setImageSource] = useState<"cardnews" | "ai">("cardnews");
  const [font, setFont] = useState("nanum-gothic");
  const [bgm, setBgm] = useState("bright");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // 사업장이 정해지면 글 목록 조회 — 상태 갱신은 응답 콜백에서만(effect 본문 동기 setState 금지).
  useEffect(() => {
    if (!bizId) return;
    let alive = true;
    listRecapPostsAction(bizId).then((r) => {
      if (!alive) return;
      setPosts(r.posts);
      setLoadingPosts(false);
      if (r.error) setMsg(r.error);
    });
    return () => {
      alive = false;
    };
  }, [bizId]);

  // 사업장 변경(이벤트)에서 목록 초기화 + 로딩 표시.
  const changeBusiness = (id: string) => {
    setBizId(id);
    setPosts([]);
    setPostId("");
    setLoadingPosts(!!id);
  };
  // 글 변경(이벤트): 카드뉴스 배경이 없는 글이면 AI 소스로 전환.
  const changePost = (id: string) => {
    setPostId(id);
    const p = posts.find((x) => x.id === id);
    if (p && !p.hasCardBackgrounds) setImageSource("ai");
  };

  const selected = posts.find((p) => p.id === postId) ?? null;
  // 파생값: 배경 없는 글은 항상 AI 소스(렌더·제출 모두 이 값을 쓴다).
  const effectiveSource: "cardnews" | "ai" =
    selected && !selected.hasCardBackgrounds ? "ai" : imageSource;

  const estScenes = 6;
  const estCredits =
    (basePrice ?? 0) + (effectiveSource === "ai" ? (imagePrice ?? 0) * estScenes : 0);
  const priceKnown = basePrice !== null && (effectiveSource !== "ai" || imagePrice !== null);
  const tooLow = priceKnown && credits < estCredits;

  const create = () =>
    start(async () => {
      setMsg(null);
      if (!bizId || !postId) {
        setMsg("사업장과 글을 선택해주세요.");
        return;
      }
      const res = await createRecapJobAction({
        businessId: bizId,
        blogPostId: postId,
        voice,
        imageSource: effectiveSource,
        font,
        bgm,
      });
      if (res.error) setMsg(res.error);
      else {
        setMsg("대본을 만들었어요. 아래 작업에서 내레이션을 이어서 만들어주세요.");
        router.refresh();
      }
    });

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <h2 className="font-semibold">새 요약 쇼츠 만들기</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label required>고객 사업장</Label>
          <Select value={bizId} onChange={(e) => changeBusiness(e.target.value)} disabled={busy}>
            {businesses.length === 0 && <option value="">배정된 사업장이 없습니다</option>}
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label required>블로그 글(발행된 글)</Label>
          <Select
            value={postId}
            onChange={(e) => changePost(e.target.value)}
            disabled={busy || loadingPosts}
          >
            <option value="">{loadingPosts ? "불러오는 중…" : "선택"}</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.hasCardBackgrounds ? " · 카드뉴스 있음" : ""}
              </option>
            ))}
          </Select>
          {!loadingPosts && bizId && posts.length === 0 && (
            <p className="mt-1 text-xs text-muted">발행된 글이 없어요.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>목소리</Label>
          <div className="flex flex-wrap gap-1.5">
            {RECAP_VOICES.map((v) => (
              <Chip key={v.id} active={voice === v.id} onClick={() => setVoice(v.id)} disabled={busy} title={v.desc}>
                {v.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <Label>이미지 소스</Label>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={effectiveSource === "cardnews"}
              onClick={() => setImageSource("cardnews")}
              disabled={busy || (!!selected && !selected.hasCardBackgrounds)}
              title="이 글의 카드뉴스 배경 사진을 재사용(추가 패킷 없음)"
            >
              카드뉴스 배경
            </Chip>
            <Chip active={effectiveSource === "ai"} onClick={() => setImageSource("ai")} disabled={busy} title="장면마다 AI 이미지 생성(장당 패킷)">
              AI 생성
            </Chip>
          </div>
          {selected && !selected.hasCardBackgrounds && (
            <p className="mt-1 text-xs text-muted">이 글은 카드뉴스가 없어 AI 생성만 가능해요.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>자막 폰트</Label>
          <div className="flex flex-wrap gap-1.5">
            {CARD_FONTS.map((f) => (
              <Chip key={f.id} active={font === f.id} onClick={() => setFont(f.id)} disabled={busy}>
                <span style={{ fontFamily: f.stack }}>{f.name}</span>
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <Label>배경 음악</Label>
          <div className="flex flex-wrap gap-1.5">
            {SHORTS_MOODS.map((m) => (
              <Chip key={m.id} active={bgm === m.id} onClick={() => setBgm(m.id)} disabled={busy}>
                {m.ko}
              </Chip>
            ))}
          </div>
          {BGM_AVAILABLE && (
            <Select className="mt-2" value={bgm.startsWith("library:") ? bgm : ""} onChange={(e) => e.target.value && setBgm(e.target.value)} disabled={busy}>
              <option value="">라이브러리에서 고르기…</option>
              {BGM_TRACKS.map((t) => (
                <option key={t.id} value={`library:${t.id}`}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          예상 패킷:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {priceKnown ? estCredits : "단가 미설정"}
          </span>
          {effectiveSource === "ai" && priceKnown && (
            <span className="ml-1 text-xs">(대본·내레이션 {basePrice} + AI 이미지 약 {estScenes}장 × {imagePrice})</span>
          )}
          {tooLow && <span className="ml-2 text-danger">패킷이 부족해요</span>}
        </p>
        <Button onClick={create} disabled={disabled || busy || !bizId || !postId || !priceKnown || tooLow}>
          {busy ? (
            <>
              <Spinner className="size-4" /> 대본 만드는 중…
            </>
          ) : (
            "대본 만들기 (패킷 차감)"
          )}
        </Button>
      </div>
      {msg && <p className="text-sm text-primary">{msg}</p>}
    </Card>
  );
}

// ---------------- 작업 카드 ----------------
function JobCard({
  job,
  youtube,
  imagePrice,
}: {
  job: RecapJobView;
  youtube: { configured: boolean; connected: boolean; channelTitle: string | null };
  imagePrice: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(job.status !== "ready");
  const [log, setLog] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState<null | "audio" | "images" | "render" | "upload" | "delete">(null);
  const [progress, setProgress] = useState(0);
  const [lastBlob, setLastBlob] = useState<{ blob: Blob; ext: string } | null>(null);
  const [ytLink, setYtLink] = useState<string | null>(null);
  const abortRef = useRef(false);

  const scenes = job.scenes;
  const audioDone = scenes.filter((s) => !!s.audioUrl).length;
  const imageDone = scenes.filter((s) => !!s.imageUrl).length;
  const needImages = job.imageSource === "ai";
  const canRender =
    scenes.length > 0 && audioDone === scenes.length && imageDone === scenes.length;
  const totalSec = useMemo(
    () =>
      scenes.reduce(
        (a, s) => a + Math.max(SCENE_MIN_MS, (s.durationMs ?? 0) + SCENE_PAD_MS),
        0,
      ) / 1000,
    [scenes],
  );

  // ── 내레이션(TTS) — done 까지 반복 호출(서버가 동시성 3으로 처리, 멱등)
  const makeAudio = async () => {
    setErr(null);
    setLog("내레이션 합성 중…");
    setRunning("audio");
    try {
      for (let round = 0; round < 4; round++) {
        const r = await synthRecapAudioAction(job.id);
        if (r.error) throw new Error(r.error);
        if (r.done) break;
        if (r.failed.length > 0 && round === 3)
          throw new Error(`일부 장면(${r.failed.map((i) => i + 1).join(", ")}번) 합성에 실패했어요. 다시 시도해주세요.`);
      }
      setLog("내레이션 완료");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "내레이션 합성 실패");
    } finally {
      setRunning(null);
    }
  };

  // ── AI 이미지 — 장면별 순차
  const makeImages = async () => {
    setErr(null);
    setRunning("images");
    abortRef.current = false;
    try {
      const todo = scenes.filter((s) => !s.imageUrl);
      for (let i = 0; i < todo.length; i++) {
        if (abortRef.current) break;
        setLog(`이미지 생성 중… (${i + 1}/${todo.length})`);
        const r = await generateRecapSceneImageAction(job.id, todo[i].idx);
        if (r.error) throw new Error(r.error);
      }
      setLog("이미지 완료");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "이미지 생성 실패");
    } finally {
      setRunning(null);
    }
  };

  // ── 영상 만들기(브라우저 렌더)
  const render = async () => {
    setErr(null);
    setYtLink(null);
    // Safari: 사용자 제스처 안에서 동기적으로 AudioContext 생성·resume.
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const AC = new AudioCtx();
    void AC.resume();
    setRunning("render");
    setProgress(0);
    let imgs: HTMLImageElement[] = [];
    try {
      if (document.visibilityState !== "visible")
        throw new Error("이 탭이 화면에 보이는 상태에서 만들어주세요.");
      setLog("이미지·음성 불러오는 중…");
      imgs = await Promise.all(scenes.map((s) => urlToImage(s.imageUrl as string)));
      const bufs = await Promise.all(
        scenes.map(async (s) => {
          const ab = await (await fetch(s.audioUrl as string, { mode: "cors" })).arrayBuffer();
          return AC.decodeAudioData(ab);
        }),
      );
      // 타임라인 — 장면 길이 = 내레이션 길이 + 여백(최소 1.5초).
      const durations = bufs.map((b) => Math.max(SCENE_MIN_MS, b.duration * 1000 + SCENE_PAD_MS));
      const starts: number[] = [];
      let acc = 0;
      for (const d of durations) {
        starts.push(acc);
        acc += d;
      }
      const total = acc / 1000;

      // 자막 폰트(한글 슬라이스 포함) 로드.
      const captions = scenes.map((s) => s.caption || null);
      const { family, weight } = canvasFontForCard(job.font);
      setLog("폰트 준비 중…");
      await ensureCanvasFont(weight, 56, family, captions.filter(Boolean).join(" "));

      // 믹스 버스: BGM → duck → limiter → dest ← 내레이션
      const bus = createMixBus(AC);
      let bed: { start: (at?: number) => void; stop: () => void } | null = null;
      if (job.bgm.startsWith("library:")) {
        const id = job.bgm.slice("library:".length);
        const track = BGM_TRACKS.find((t) => t.id === id);
        if (track) {
          const ab = await (await fetch(track.url)).arrayBuffer();
          const buf = await AC.decodeAudioData(ab);
          bed = createCustomBed(AC, buf, total, 1, 1, bus.duckGain);
        }
      } else if (job.bgm !== "none") {
        const mood = job.bgm as "bright" | "calm" | "energetic";
        bed = createMusicBed(AC, mood, total, 1, 1, bus.duckGain);
      }
      const narr = createNarrationTrack(
        AC,
        bufs.map((b, i) => ({ buffer: b, atSec: starts[i] / 1000 + NARRATION_LEAD_SEC })),
        bus.limiter,
        bus.duckGain,
      );

      if (AC.state !== "running") await AC.resume();
      if (AC.state !== "running")
        throw new Error("오디오를 시작하지 못했어요. 다시 눌러주세요.");

      setLog("영상 만드는 중… 탭을 닫지 마세요");
      const base = AC.currentTime + 0.25;
      bed?.start(base);
      narr.start(base);
      const result = await renderShortsVideo(imgs, {
        width: 1080,
        height: 1920,
        durations,
        transitionMs: 600,
        motion: "static",
        fps: 30,
        audioStream: bus.dest.stream,
        clock: () => Math.max(0, (AC.currentTime - base) * 1000),
        captions,
        captionStyle: { fontFamily: family, fontWeight: weight, fontSizePx: 56 },
        onProgress: setProgress,
      });
      narr.stop();
      bed?.stop();
      saveBlob(result.blob, `${slug(job.title)}-recap.${result.ext}`);
      setLastBlob({ blob: result.blob, ext: result.ext });
      await finalizeRecapJobAction(job.id);
      setLog("영상을 저장했어요! 유튜브 쇼츠·틱톡·릴스에 올려보세요.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "영상 만들기에 실패했어요.");
    } finally {
      imgs.forEach((im) => {
        try {
          URL.revokeObjectURL(im.src);
        } catch {
          /* noop */
        }
      });
      AC.close().catch(() => {});
      setRunning(null);
      setProgress(0);
    }
  };

  const upload = async () => {
    if (!lastBlob) return;
    setRunning("upload");
    setErr(null);
    const r = await uploadShortToYoutube(lastBlob.blob, { title: job.title });
    if (r.error) setErr(r.error);
    else setYtLink(r.link ?? null);
    setRunning(null);
  };

  const remove = async () => {
    if (!confirm("이 작업을 삭제할까요? (내레이션이 하나도 없으면 패킷이 환불됩니다)")) return;
    setRunning("delete");
    const r = await deleteRecapJobAction(job.id);
    if (r.error) setErr(r.error);
    else router.refresh();
    setRunning(null);
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)}>
          <p className="truncate font-semibold">{job.title || "(제목 없음)"}</p>
          <p className="mt-0.5 text-xs text-muted">
            {job.businessName ? `${job.businessName} · ` : ""}
            장면 {scenes.length} · 내레이션 {audioDone}/{scenes.length}
            {needImages ? ` · 이미지 ${imageDone}/${scenes.length}` : " · 카드뉴스 배경"}
            {totalSec > 0 ? ` · 약 ${totalSec.toFixed(0)}초` : ""}
          </p>
        </button>
        <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
          {STATUS_LABEL[job.status] ?? job.status}
        </span>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          {/* 단계 버튼 */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={makeAudio} disabled={!!running || audioDone === scenes.length}>
              {running === "audio" ? <Spinner className="size-4" /> : null}
              {audioDone === scenes.length ? "내레이션 완료" : `내레이션 만들기 (${scenes.length - audioDone}장면)`}
            </Button>
            {needImages && (
              <Button size="sm" variant="outline" onClick={makeImages} disabled={!!running || imageDone === scenes.length}>
                {running === "images" ? <Spinner className="size-4" /> : null}
                {imageDone === scenes.length
                  ? "이미지 완료"
                  : `AI 이미지 만들기 (${scenes.length - imageDone}장${imagePrice !== null ? ` · 장당 ${imagePrice}` : ""})`}
              </Button>
            )}
            <Button size="sm" onClick={render} disabled={!!running || !canRender}>
              {running === "render" ? (
                <>
                  <Spinner className="size-4" /> {Math.round(progress * 100)}%
                </>
              ) : (
                "영상 만들기 (브라우저)"
              )}
            </Button>
            {youtube.configured && youtube.connected && (
              <Button size="sm" variant="outline" onClick={upload} disabled={!!running || !lastBlob}>
                {running === "upload" ? <Spinner className="size-4" /> : null}
                유튜브에 올리기(비공개)
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={remove} disabled={!!running}>
              삭제
            </Button>
          </div>
          {running === "render" && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          {log && <p className="text-sm text-primary">{log}</p>}
          {err && <p className="text-sm text-danger">{err}</p>}
          {ytLink && (
            <p className="text-sm text-primary">
              업로드 완료!{" "}
              <a href={ytLink} target="_blank" rel="noopener noreferrer" className="underline">
                {ytLink}
              </a>
            </p>
          )}
          {!youtube.configured && (
            <p className="text-[11px] text-muted">유튜브 자동 업로드는 관리자 연동 후 활성화됩니다.</p>
          )}
          {youtube.configured && !youtube.connected && (
            <p className="text-[11px] text-muted">
              유튜브에 바로 올리려면 파트너 홈의 고객 워크스페이스(마케팅)에서 구글 계정을 연결하세요.
            </p>
          )}

          {/* 장면 편집 */}
          <div className="space-y-2">
            {scenes.map((s) => (
              <SceneEditor key={s.idx} jobId={job.id} scene={s} disabled={!!running} />
            ))}
          </div>
          <p className="text-[11px] text-muted">
            내레이션 문장을 고치면 그 장면만 다시 합성됩니다(추가 패킷 없음). 영상은 브라우저에서 만들어지니 완료될 때까지 탭을 닫지 마세요.
          </p>
        </div>
      )}
    </Card>
  );
}

function SceneEditor({
  jobId,
  scene,
  disabled,
}: {
  jobId: string;
  scene: RecapScene;
  disabled: boolean;
}) {
  const router = useRouter();
  const [narration, setNarration] = useState(scene.narration);
  const [caption, setCaption] = useState(scene.caption);
  const [busy, start] = useTransition();
  const dirty = narration !== scene.narration || caption !== scene.caption;

  const save = () =>
    start(async () => {
      const r = await updateRecapSceneAction(jobId, scene.idx, { narration, caption });
      if (!r.error) router.refresh();
    });

  return (
    <div className="flex gap-3 rounded-xl border border-border p-3">
      <div className="w-14 shrink-0">
        {scene.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 장면 썸네일(스토리지)
          <img src={scene.imageUrl} alt="" className="aspect-[9/16] w-14 rounded border border-border object-cover" />
        ) : (
          <div className="flex aspect-[9/16] w-14 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted">
            이미지
          </div>
        )}
        <p className="mt-1 text-center text-[10px] text-muted">
          #{scene.idx + 1}
          {scene.durationMs ? ` · ${(scene.durationMs / 1000).toFixed(1)}s` : ""}
        </p>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <Label>내레이션 {scene.audioUrl ? <span className="text-success">· 음성 있음</span> : <span className="text-muted">· 음성 대기</span>}</Label>
          <Textarea value={narration} onChange={(e) => setNarration(e.target.value)} rows={2} disabled={disabled || busy} />
        </div>
        <div>
          <Label>자막</Label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} disabled={disabled || busy} maxLength={80} />
        </div>
        {scene.error && <p className="text-xs text-danger">{scene.error}</p>}
        {dirty && (
          <Button size="sm" variant="outline" onClick={save} disabled={disabled || busy}>
            {busy ? "저장 중…" : "저장"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 " +
        (active ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary/50")
      }
    >
      {children}
    </button>
  );
}

function slug(s: string) {
  return (s || "storyup").replace(/[^\w가-힣-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "storyup";
}
