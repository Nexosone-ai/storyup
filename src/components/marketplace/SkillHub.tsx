"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  importGithubSkillAction,
  removeSkillSourceAction,
} from "@/app/partner/designer/skills/actions";

export interface SkillSourceRow {
  id: string;
  repo: string;
  ref: string | null;
  commitSha: string;
  skillName: string;
  description: string | null;
  license: string | null;
  compatibility: string | null;
  skillType: "A" | "B" | "C" | "D";
  supportLevel: "instructions" | "adapter" | "blocked";
  supportReason: string | null;
  createdAt: string;
}
export interface CatalogItem {
  id: string;
  repoUrl: string;
  title: string;
  description: string | null;
  tag: string | null;
}

const SUPPORT: Record<
  SkillSourceRow["supportLevel"],
  { label: string; cls: string }
> = {
  instructions: {
    label: "지침 지원",
    cls: "border-emerald-300 text-emerald-700 bg-emerald-50",
  },
  adapter: {
    label: "어댑터 필요",
    cls: "border-amber-300 text-amber-700 bg-amber-50",
  },
  blocked: { label: "차단됨", cls: "border-red-300 text-red-700 bg-red-50" },
};

const TYPE_HINT: Record<SkillSourceRow["skillType"], string> = {
  A: "A · 지침형",
  B: "B · 에셋 포함",
  C: "C · 스크립트/도구",
  D: "D · 미지원/차단",
};

export function SkillHub({
  skills,
  catalog = [],
}: {
  skills: SkillSourceRow[];
  catalog?: CatalogItem[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const importUrl = (target: string, done?: () => void) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await importGithubSkillAction(target);
      if (res.error) {
        setError(res.error);
        return;
      }
      done?.();
      setNotice("가져왔어요. 아래 보관함에 추가됐습니다.");
      router.refresh();
    });
  };

  const doImport = () => importUrl(url, () => setUrl(""));

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await removeSkillSourceAction(id);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">디자이너 스튜디오</p>
          <h1 className="text-2xl font-semibold tracking-tight">Skill 보관함</h1>
          <p className="mt-1.5 text-sm text-muted">
            공개 GitHub 저장소의 Agent Skill을 가져와 디자인 작업에 참고할 수 있어요.
            가져오기는 특정 commit으로 고정되며, 원본 스크립트는 실행하지 않습니다.
          </p>
        </div>
        <Link
          href="/partner/designer"
          className="shrink-0 text-sm text-muted underline underline-offset-2 hover:text-primary"
        >
          ← 템플릿
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <label className="mb-2 block text-sm font-semibold">GitHub 저장소에서 가져오기</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            inputMode="url"
            placeholder="https://github.com/owner/repo 또는 .../tree/main/skills/my-skill"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button onClick={doImport} disabled={busy || !url.trim()}>
            {busy ? <Spinner className="size-4" /> : "가져오기"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          공개 저장소만 지원해요. SKILL.md(Agent Skills 형식)가 있는 저장소나 폴더 주소를 붙여넣으세요.
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {notice && <p className="mt-2 text-sm text-emerald-600">{notice}</p>}
      </div>

      {/* 추천 스킬(관리자 큐레이션) — 원클릭 가져오기 */}
      {catalog.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-1 text-sm font-semibold">추천 스킬</p>
          <p className="mb-3 text-xs text-muted">
            STORYUP이 추천하는 공개 스킬이에요. [가져오기]를 누르면 보관함에 추가됩니다.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {catalog.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.title}
                    {c.tag && <span className="ml-2 text-xs text-muted">· {c.tag}</span>}
                  </p>
                  {c.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{c.description}</p>
                  )}
                  <a
                    href={c.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-xs text-primary underline underline-offset-2"
                  >
                    {c.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                  </a>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => importUrl(c.repoUrl)}
                >
                  가져오기
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {skills.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {skills.map((s) => {
            const sup = SUPPORT[s.supportLevel];
            return (
              <li key={s.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.skillName}</p>
                    <p className="truncate text-xs text-muted">{s.repo}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${sup.cls}`}
                  >
                    {sup.label}
                  </span>
                </div>
                {s.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{s.description}</p>
                )}
                <dl className="mt-3 space-y-1 text-xs text-muted">
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-medium text-foreground/70">유형</dt>
                    <dd>{TYPE_HINT[s.skillType]}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-medium text-foreground/70">라이선스</dt>
                    <dd>{s.license ?? "불명확(확인 필요)"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-medium text-foreground/70">commit</dt>
                    <dd className="truncate font-mono">{s.commitSha.slice(0, 10)}</dd>
                  </div>
                  {s.supportReason && (
                    <div className="flex gap-2">
                      <dt className="shrink-0 font-medium text-foreground/70">메모</dt>
                      <dd>{s.supportReason}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <a
                    href={`https://github.com/${s.repo}/tree/${s.commitSha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline underline-offset-2"
                  >
                    원본 보기
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    disabled={busy}
                    className="text-sm text-muted underline underline-offset-2 hover:text-danger"
                  >
                    삭제
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          아직 가져온 Skill이 없어요. 위에 공개 GitHub 주소를 붙여넣어 시작하세요.
        </p>
      )}
    </div>
  );
}
