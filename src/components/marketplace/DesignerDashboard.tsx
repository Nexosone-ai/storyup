"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { SAMPLE_SKILL_LIST } from "@/lib/marketplace/samples";
import { createTemplateFromSample } from "@/app/partner/designer/actions";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  submitted: "심사 요청",
  approved: "승인",
  published: "판매중",
  rejected: "반려",
  suspended: "정지",
  archived: "보관",
};

export interface TemplateRow {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

export function DesignerDashboard({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const create = (sampleKey: string) => {
    setError(null);
    startTransition(async () => {
      const res = await createTemplateFromSample(sampleKey);
      if (res.error || !res.templateId) {
        setError(res.error ?? "생성에 실패했어요.");
        return;
      }
      router.push(`/partner/designer/templates/${res.templateId}/edit`);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-2">디자이너 스튜디오</p>
        <h1 className="text-2xl font-semibold tracking-tight">내 템플릿</h1>
        <p className="mt-1.5 text-sm text-muted">
          Skill로 템플릿을 만들어 편집·미리보기하고 심사를 요청하세요.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold">샘플 Skill에서 시작</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_SKILL_LIST.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => create(s.key)}
            >
              {busy ? <Spinner className="size-4" /> : s.label}
            </Button>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {templates.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((tpl) => (
            <li key={tpl.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{tpl.title || "제목 없음"}</p>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                  {STATUS_LABEL[tpl.status] ?? tpl.status}
                </span>
              </div>
              <Link
                href={`/partner/designer/templates/${tpl.id}/edit`}
                className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-2"
              >
                편집
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">아직 템플릿이 없어요. 위에서 샘플을 골라 시작해보세요.</p>
      )}
    </div>
  );
}
