"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  createSimilarBatchAction,
  pollSimilarBatchAction,
  type JobView,
} from "@/app/partner/similar-video/actions";
import { VIDEO_LENGTHS, videoLengthById } from "@/lib/videoLength";

export interface BatchView {
  id: string;
  concept: string;
  status: string;
  aspect: string;
  seconds: number;
  sourceThumb: string | null;
  jobs: JobView[];
}

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

/** 배치에 저장된 길이(초) → 사람이 읽는 라벨(가장 가까운 옵션). */
function lengthLabelBySeconds(seconds: number): string {
  const hit = VIDEO_LENGTHS.find((l) => l.seconds === seconds);
  return hit ? hit.label : `약 ${seconds}초`;
}

/** 비율 → 미리보기 타일 종횡비 클래스. */
function ratioClass(aspect: string): string {
  if (aspect === "16:9") return "aspect-video";
  if (aspect === "1:1") return "aspect-square";
  return "aspect-[9/16]";
}

export function SimilarVideoStudio({
  configured,
  batches: initial,
  credits,
  cost,
}: {
  configured: boolean;
  batches: BatchView[];
  /** 파트너 보유 크레딧(패킷). */
  credits: number;
  /** 1회(10편) 생성 크레딧 단가. null = 미설정(생성 차단). */
  cost: number | null;
}) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [concept, setConcept] = useState("");
  const [aspect, setAspect] = useState("9:16");
  const [quality, setQuality] = useState("720p");
  const [lengthId, setLengthId] = useState("s5");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchView[]>(initial);

  // 폴링용 최신 배치 스냅샷(인터벌 클로저 stale 방지) — 렌더가 아닌 effect에서 동기화.
  const batchesRef = useRef(batches);
  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  const pollAll = useCallback(async () => {
    const processing = batchesRef.current.filter((b) => b.status === "processing");
    if (processing.length === 0) return;
    const results = await Promise.all(
      processing.map(async (b) => ({
        id: b.id,
        res: await pollSimilarBatchAction(b.id).catch(() => null),
      })),
    );
    setBatches((prev) =>
      prev.map((b) => {
        const hit = results.find((r) => r.id === b.id);
        if (!hit || !hit.res) return b;
        return { ...b, status: hit.res.status, jobs: hit.res.jobs };
      }),
    );
  }, []);

  // 처리 중 배치가 있으면 5초마다 폴링.
  useEffect(() => {
    const hasProcessing = batches.some((b) => b.status === "processing");
    if (!hasProcessing) return;
    const t = setInterval(pollAll, 5000);
    // 즉시 한 번도 확인.
    pollAll();
    return () => clearInterval(t);
  }, [batches, pollAll]);

  // 선택한 길이의 배수를 단가에 반영 — 길수록 크레딧을 더 차감.
  const length = videoLengthById(lengthId);
  const effCost = cost === null ? null : cost * length.multiplier;

  // 단가 미설정(null)이면 서버가 차단하므로 비활성, 잔액 부족도 사전 차단.
  const priceKnown = effCost !== null;
  const chargeable = priceKnown && (effCost ?? 0) > 0;
  const tooLow = chargeable && credits < (effCost ?? 0);

  const create = async () => {
    setError(null);
    if (!sourceUrl.trim()) {
      setError("원본 영상 URL을 입력해주세요.");
      return;
    }
    setCreating(true);
    try {
      const res = await createSimilarBatchAction(
        sourceUrl,
        concept,
        aspect,
        quality,
        lengthId,
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.batchId) {
        setBatches((prev) => [
          {
            id: res.batchId!,
            concept: concept.trim() || "(원본 제목으로 생성)",
            status: "processing",
            aspect,
            seconds: length.seconds,
            sourceThumb: null,
            jobs: [],
          },
          ...prev,
        ]);
        setSourceUrl("");
        setConcept("");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-2">파트너 · 영상 10배</p>
        <h1 className="text-2xl font-semibold tracking-tight">유사 영상 10개 만들기</h1>
        <p className="mt-1.5 text-muted">
          원본 영상(유튜브 등) 링크와 컨셉 한 줄을 넣으면, 같은 분위기의 새 영상 10개를
          서로 다른 연출로 한 번에 생성해요.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border bg-surface px-2.5 py-1">
            1회(10편 · {length.label}) ={" "}
            <strong className="text-foreground">
              {effCost === null
                ? "미설정"
                : effCost === 0
                  ? "무료"
                  : `${effCost} 크레딧`}
            </strong>
          </span>
          <span className="rounded-full border border-border bg-surface px-2.5 py-1">
            보유 <strong className="text-foreground">{credits.toLocaleString()}</strong> 크레딧
          </span>
        </div>
      </div>

      {!configured && (
        <Card className="border-amber-300/50 bg-amber-50/40 p-4 text-sm dark:bg-amber-500/10">
          영상 엔진이 아직 설정되지 않았어요(FAL_KEY). 관리자 설정 후 이용할 수 있어요.
        </Card>
      )}

      {/* 생성 폼 */}
      <Card className="p-4 sm:p-5">
        <label className="text-xs text-muted">
          원본 영상 URL
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className={`mt-1 ${field}`}
            disabled={!configured || creating}
          />
        </label>
        <label className="mt-3 block text-xs text-muted">
          컨셉(주제·분위기) — 비우면 유튜브 제목을 사용해요
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            rows={2}
            placeholder="예: 카페 신메뉴 딸기라떼 홍보, 밝고 상큼한 분위기"
            className={`mt-1 resize-none ${field}`}
            disabled={!configured || creating}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted">
            영상 길이
            <select
              value={lengthId}
              onChange={(e) => setLengthId(e.target.value)}
              className={`mt-1 ${field}`}
              disabled={!configured || creating}
            >
              {VIDEO_LENGTHS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                  {l.multiplier > 1 ? ` · ${l.multiplier}배 크레딧` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            비율
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value)}
              className={`mt-1 ${field}`}
              disabled={!configured || creating}
            >
              <option value="9:16">세로 9:16 (쇼츠·릴스)</option>
              <option value="16:9">가로 16:9 (유튜브)</option>
              <option value="1:1">정사각 1:1 (피드)</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            화질
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className={`mt-1 ${field}`}
              disabled={!configured || creating}
            >
              <option value="480p">480p (빠름)</option>
              <option value="720p">720p (권장)</option>
              <option value="1080p">1080p (고화질)</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={create}
            disabled={!configured || creating || !priceKnown || tooLow}
          >
            {creating
              ? "생성 요청 중…"
              : chargeable
                ? `유사 영상 10개 생성 (${effCost} 크레딧)`
                : "유사 영상 10개 생성"}
          </Button>
          <span className="text-xs text-muted">
            {tooLow
              ? "크레딧이 부족해요. 관리자에게 충전을 요청하세요."
              : !priceKnown
                ? "단가가 아직 설정되지 않았어요(관리자 설정 필요)."
                : length.seconds >= 30
                  ? "긴 영상은 모델이 거부하면 실패 처리되고 크레딧은 자동 환급돼요."
                  : "영상당 수십 초 소요 · 한 번에 10편 생성됩니다."}
          </span>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </Card>

      {/* 생성 결과(배치별) */}
      {batches.map((b) => (
        <BatchCard key={b.id} batch={b} />
      ))}
    </div>
  );
}

function BatchCard({ batch }: { batch: BatchView }) {
  const done = batch.jobs.filter((j) => j.status === "done").length;
  const failed = batch.jobs.filter((j) => j.status === "failed").length;
  const total = batch.jobs.length || 10;
  const slots: (JobView | null)[] =
    batch.jobs.length > 0
      ? batch.jobs
      : Array.from({ length: 10 }, () => null);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{batch.concept}</p>
          <p className="text-xs text-muted">
            {batch.status === "processing"
              ? `생성 중… 완료 ${done}/${total}`
              : batch.status === "done"
                ? `완료 ${done}개${failed ? ` · 실패 ${failed}개` : ""}`
                : "생성 실패"}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted">
          {batch.aspect} · {lengthLabelBySeconds(batch.seconds)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {slots.map((j, i) => (
          <div
            key={i}
            className={`${ratioClass(batch.aspect)} relative overflow-hidden rounded-xl border border-border bg-surface-muted`}
          >
            {j?.status === "done" && j.videoUrl ? (
              <video
                src={j.videoUrl}
                controls
                playsInline
                className="h-full w-full object-cover"
              />
            ) : j?.status === "failed" ? (
              <div className="grid h-full place-items-center p-2 text-center text-[11px] text-danger">
                실패
              </div>
            ) : (
              <div className="grid h-full place-items-center text-[11px] text-muted">
                <span className="animate-pulse">생성 중…</span>
              </div>
            )}
            <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
              #{i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* 완료 영상 다운로드/열기 */}
      {done > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {batch.jobs
            .filter((j) => j.status === "done" && j.videoUrl)
            .map((j) => (
              <a
                key={j.idx}
                href={j.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs hover:border-primary"
              >
                #{j.idx + 1} 영상 열기 ↗
              </a>
            ))}
        </div>
      )}
    </Card>
  );
}
