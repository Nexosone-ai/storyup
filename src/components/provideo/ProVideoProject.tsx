"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  generateStoryboardAction,
  updateSceneAction,
  generateAssetsAction,
  generateSceneImageAction,
  generateAssetImageAction,
  generateMusicAction,
} from "@/app/partner/video/actions";
import type { ProviderStatus } from "./ProVideoStudio";

export interface SceneRow {
  id: string;
  idx: number;
  script: string | null;
  imagePrompt: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
}
export interface AssetRow {
  id: string;
  kind: "background" | "prop";
  label: string;
  prompt: string | null;
  imageUrl: string | null;
}

export function ProVideoProject({
  project,
  scenes,
  assets,
  providers,
}: {
  project: {
    id: string;
    title: string;
    concept: string;
    status: string;
    aspect: string;
    quality: string;
    musicPrompt: string | null;
    musicUrl: string | null;
  };
  scenes: SceneRow[];
  assets: AssetRow[];
  providers: ProviderStatus;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = (id: string | null, fn: () => Promise<{ error?: string }>) => {
    setError(null);
    setMsg(null);
    setPendingId(id);
    start(async () => {
      const res = await fn();
      setPendingId(null);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const genStoryboard = () => {
    setError(null);
    setMsg(null);
    start(async () => {
      const res = await generateStoryboardAction(project.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const saveScene = (sceneId: string, patch: { script?: string; imagePrompt?: string }) =>
    start(async () => {
      const res = await updateSceneAction(sceneId, patch);
      setMsg(res.error ?? "저장됨");
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">
            <Link href="/partner/video" className="underline underline-offset-2">
              ← 전문 영상
            </Link>
          </p>
          <h1 className="text-xl font-semibold">{project.title || "제목 없음"}</h1>
          <p className="mt-1 text-sm text-muted">
            {project.aspect} · {project.quality}
          </p>
        </div>
        <Button onClick={genStoryboard} disabled={busy || !providers.story}>
          {busy ? (
            <Spinner className="size-4" />
          ) : scenes.length > 0 ? (
            "스토리보드 재생성"
          ) : (
            "스토리보드 생성(Claude)"
          )}
        </Button>
      </div>
      {!providers.story && (
        <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
          스토리 엔진(Claude)이 아직 설정되지 않았어요(ANTHROPIC_API_KEY).
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {msg && <p className="text-sm text-primary">{msg}</p>}

      <div className="rounded-xl border border-border bg-surface p-3 text-sm">
        <p className="font-medium">컨셉</p>
        <p className="mt-1 whitespace-pre-wrap text-muted">{project.concept}</p>
        {project.musicPrompt && (
          <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">음악(SUNO)</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run("music", () => generateMusicAction(project.id))}
                disabled={busy || !providers.music}
              >
                {busy && pendingId === "music" ? (
                  <Spinner className="size-4" />
                ) : project.musicUrl ? (
                  "음악 재생성"
                ) : (
                  "음악 생성(SUNO)"
                )}
              </Button>
            </div>
            <p className="mt-1 text-muted">{project.musicPrompt}</p>
            {!providers.music && (
              <p className="mt-1 text-xs text-muted">
                음악 생성은 SUNO 설정(SUNO_API_KEY·SUNO_API_BASE) 후 활성화돼요.
              </p>
            )}
            {project.musicUrl && (
              <audio controls src={project.musicUrl} className="mt-2 w-full" />
            )}
          </>
        )}
      </div>

      {/* 에셋(배경·소품) — 영상 전에 미리 생성 */}
      {scenes.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">에셋(배경·소품) 사전 생성</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => run("assets", () => generateAssetsAction(project.id))}
              disabled={busy || !providers.story}
            >
              {busy && pendingId === "assets" ? (
                <Spinner className="size-4" />
              ) : assets.length > 0 ? (
                "에셋 다시 설계"
              ) : (
                "에셋 목록 설계(Claude)"
              )}
            </Button>
          </div>
          {assets.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {assets.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-2"
                >
                  {a.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 원격 생성 이미지
                    <img src={a.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded bg-surface-muted/40 text-[10px] text-muted">
                      {a.kind === "background" ? "배경" : "소품"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.label}</p>
                    <p className="truncate text-xs text-muted">{a.prompt}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(a.id, () => generateAssetImageAction(a.id))}
                    disabled={busy || !providers.image}
                  >
                    {busy && pendingId === a.id ? (
                      <Spinner className="size-4" />
                    ) : a.imageUrl ? (
                      "재생성"
                    ) : (
                      "이미지"
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted">
              배경(앵글별)·소품을 미리 설계해 두면 영상 생성 시 재생성이 줄어 크레딧을 아껴요.
              {!providers.image && " (이미지 생성은 GPT 키 설정 후 활성화)"}
            </p>
          )}
        </div>
      )}

      {/* 장면(스토리보드) */}
      {scenes.length === 0 ? (
        <p className="text-sm text-muted">
          아직 장면이 없어요. ‘스토리보드 생성’을 눌러 Claude가 장면·이미지 프롬프트를 만들게 하세요.
        </p>
      ) : (
        <ol className="space-y-3">
          {scenes.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted">장면 {s.idx + 1}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => run(s.id, () => generateSceneImageAction(s.id))}
                  disabled={busy || !providers.image || !s.imagePrompt}
                >
                  {busy && pendingId === s.id ? (
                    <Spinner className="size-4" />
                  ) : s.imageUrl ? (
                    "이미지 재생성"
                  ) : (
                    "이미지 생성(GPT)"
                  )}
                </Button>
              </div>
              {s.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- 원격 생성 이미지
                <img
                  src={s.imageUrl}
                  alt=""
                  className="mb-2 max-h-56 w-auto rounded-lg border border-border"
                />
              )}
              <label className="block text-xs text-muted">스크립트/설명</label>
              <textarea
                defaultValue={s.script ?? ""}
                rows={2}
                onBlur={(e) => saveScene(s.id, { script: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <label className="mt-2 block text-xs text-muted">이미지 프롬프트(GPT용·영어)</label>
              <textarea
                defaultValue={s.imagePrompt ?? ""}
                rows={2}
                onBlur={(e) => saveScene(s.id, { imagePrompt: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                  영상(Seedance): {providers.video ? "준비됨(후속 단계)" : "준비중"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="text-xs text-muted">
        이미지(GPT)·영상(Seedance)·음악(SUNO) 생성은 다음 단계에서 활성화됩니다. 지금은 스토리보드와
        프롬프트를 만들고 다듬는 단계예요.
      </p>
    </div>
  );
}
