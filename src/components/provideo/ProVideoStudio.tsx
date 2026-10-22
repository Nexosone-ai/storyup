"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { createProVideoProject } from "@/app/partner/video/actions";

export interface ProjectRow {
  id: string;
  title: string;
  concept: string;
  status: string;
  aspect: string;
  quality: string;
}
export interface BizOption {
  id: string;
  name: string;
}
export interface ProviderStatus {
  story: boolean;
  image: boolean;
  video: boolean;
  music: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  storyboard: "스토리보드",
  assets: "에셋",
  rendering: "렌더링",
  done: "완료",
};

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs ${
        ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-border bg-surface text-muted"
      }`}
    >
      {label} {ok ? "준비됨" : "준비중"}
    </span>
  );
}

export function ProVideoStudio({
  projects,
  businesses,
  providers,
}: {
  projects: ProjectRow[];
  businesses: BizOption[];
  providers: ProviderStatus;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bizId, setBizId] = useState(businesses[0]?.id ?? "");
  const [concept, setConcept] = useState("");
  const [aspect, setAspect] = useState("9:16");
  const [quality, setQuality] = useState("720p");

  const create = () => {
    setError(null);
    start(async () => {
      const res = await createProVideoProject({ businessId: bizId, concept, aspect, quality });
      if (res.error || !res.projectId) {
        setError(res.error ?? "생성 실패");
        return;
      }
      router.push(`/partner/video/${res.projectId}`);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-2">파트너 · 전문 영상</p>
        <h1 className="text-2xl font-semibold tracking-tight">전문 영상 스튜디오</h1>
        <p className="mt-1.5 text-sm text-muted">
          스토리는 Claude, 이미지는 GPT, 영상은 Seedance, 음악은 SUNO로 전문 영상을 제작해요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill ok={providers.story} label="스토리(Claude)" />
          <Pill ok={providers.image} label="이미지(GPT)" />
          <Pill ok={providers.video} label="영상(Seedance)" />
          <Pill ok={providers.music} label="음악(SUNO)" />
        </div>
      </div>

      {/* 새 프로젝트 */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold">새 영상 만들기</p>
        {businesses.length === 0 ? (
          <p className="text-sm text-muted">먼저 사업장이 배정되어야 해요.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="text-muted">사업장</span>
                <select
                  value={bizId}
                  onChange={(e) => setBizId(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-2"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-muted">비율</span>
                <select
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-2"
                >
                  <option value="9:16">9:16 (숏폼)</option>
                  <option value="16:9">16:9 (가로)</option>
                  <option value="1:1">1:1 (정사각)</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-muted">화질</span>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-2"
                >
                  <option value="480p">480p (드래프트)</option>
                  <option value="720p">720p (자체 콘텐츠)</option>
                  <option value="1080p">1080p (광고)</option>
                </select>
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-muted">영상 컨셉 / 브리프</span>
              <textarea
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                rows={3}
                placeholder="예: 신메뉴 딸기케이크를 감각적으로 소개하는 15초 숏폼. 따뜻하고 고급스러운 분위기."
                className="mt-0.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <Button onClick={create} disabled={busy || !bizId || !concept.trim()}>
              {busy ? <Spinner className="size-4" /> : "프로젝트 만들기"}
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}
      </div>

      {/* 프로젝트 목록 */}
      {projects.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/partner/video/${p.id}`}
                  className="truncate font-medium text-primary underline underline-offset-2"
                >
                  {p.title || "제목 없음"}
                </Link>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs text-muted">{p.concept}</p>
              <p className="mt-1 text-xs text-muted">
                {p.aspect} · {p.quality}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">아직 만든 영상이 없어요. 위에서 컨셉을 입력해 시작하세요.</p>
      )}
    </div>
  );
}
