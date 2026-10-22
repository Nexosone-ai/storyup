"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  generateStoryboardAction,
  updateSceneAction,
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

export function ProVideoProject({
  project,
  scenes,
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
  };
  scenes: SceneRow[];
  providers: ProviderStatus;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
            <p className="mt-3 font-medium">음악 프롬프트(SUNO용)</p>
            <p className="mt-1 text-muted">{project.musicPrompt}</p>
          </>
        )}
      </div>

      {/* 장면(스토리보드) */}
      {scenes.length === 0 ? (
        <p className="text-sm text-muted">
          아직 장면이 없어요. ‘스토리보드 생성’을 눌러 Claude가 장면·이미지 프롬프트를 만들게 하세요.
        </p>
      ) : (
        <ol className="space-y-3">
          {scenes.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-2 text-xs font-semibold text-muted">장면 {s.idx + 1}</p>
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
                  이미지: {providers.image ? "생성 가능(후속)" : "준비중"}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                  영상: {providers.video ? "생성 가능(후속)" : "준비중"}
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
