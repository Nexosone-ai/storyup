"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";
import { createBusinessAction } from "@/app/onboarding/actions";
import {
  BUSINESS_CATEGORIES,
  BRAND_TONES,
  INDUSTRIES,
  WRITER_KINDS,
  WRITER_KIND_LABELS,
  type BusinessInterviewInput,
  type BusinessCategory,
  type BrandTone,
  type IndustryId,
  type WriterKind,
} from "@/types/domain";
import type { Dict } from "@/lib/i18n";

type OnbDict = Dict["onboarding"];

const empty: BusinessInterviewInput = {
  name: "",
  category: "" as BusinessCategory,
  industry: "" as IndustryId,
  founder_story: "",
  target_customer: "",
  strengths: "",
  tone: "" as BrandTone,
};

/** 카테고리 선택 후 진행할 질문(필드) 스텝의 메타. 카테고리에 따라 질문이 달라진다. */
type FieldStep = {
  field: "name" | "founder_story" | "target_customer" | "strengths" | "tone" | "industry";
  kind: "text" | "textarea" | "tone" | "industry";
  title: string;
  hint?: string;
  placeholder?: string;
};

/** 카테고리별 질문(답변) 흐름 — 작가는 창작자 맞춤 질문, 그 외는 기존 비즈니스 질문. */
function buildSteps(
  category: BusinessCategory,
  ko: boolean,
  t: OnbDict,
): FieldStep[] {
  const tone: FieldStep = { field: "tone", kind: "tone", title: t.q[5].t };

  if (category === "Artist") {
    return [
      {
        field: "name",
        kind: "text",
        title: ko ? "작가명(활동명)을 알려주세요" : "Your name or stage name",
        hint: ko ? "사이트와 작품에 표시됩니다." : "Shown on your site.",
        placeholder: ko ? "예: 김단 · 밴드명 · 필명" : "e.g. Jane Doe, a band or pen name",
      },
      {
        field: "founder_story",
        kind: "textarea",
        title: ko ? "어떻게 창작을 시작하게 되었나요?" : "How did you start creating?",
        placeholder: ko
          ? "창작을 시작한 계기와 지금까지의 여정을 들려주세요."
          : "Share what drew you to your craft and your journey so far.",
      },
      {
        field: "target_customer",
        kind: "textarea",
        title: ko ? "누구에게 작품을 전하고 싶나요?" : "Who do you want to reach?",
        placeholder: ko
          ? "어떤 사람들이 당신의 작품을 즐기면 좋을까요?"
          : "Describe the people you'd love to reach.",
      },
      {
        field: "strengths",
        kind: "textarea",
        title: ko ? "당신의 작품을 한마디로 표현하면?" : "Describe your work in a line",
        placeholder: ko
          ? "작품의 분위기·스타일·주제를 자유롭게 적어주세요."
          : "The mood, style, and themes of your work.",
      },
      tone,
    ];
  }

  // 기본(비즈니스) 질문 흐름 — 기존 사전(t.q) 재사용.
  return [
    {
      field: "name",
      kind: "text",
      title: t.q[0].t,
      hint: t.q[0].h || undefined,
      placeholder: t.q[0].p,
    },
    { field: "founder_story", kind: "textarea", title: t.q[2].t, placeholder: t.q[2].p },
    { field: "target_customer", kind: "textarea", title: t.q[3].t, placeholder: t.q[3].p },
    { field: "strengths", kind: "textarea", title: t.q[4].t, placeholder: t.q[4].p },
    tone,
    {
      field: "industry",
      kind: "industry",
      title: t.industryQ.t,
      hint: t.industryQ.h || undefined,
    },
  ];
}

export function OnboardingWizard({
  t,
  ko,
  initialCategory,
  initialIndustry,
}: {
  t: OnbDict;
  ko: boolean;
  /** '이 업종으로 시작하기'에서 넘어온 기본값(사용자가 바꿀 수 있음). */
  initialCategory?: BusinessCategory;
  initialIndustry?: IndustryId;
}) {
  const router = useRouter();
  // step 1 = 카테고리 선택, 이후 카테고리별 질문(필드) 스텝.
  const [step, setStep] = useState(1);
  const [data, setData] = useState<BusinessInterviewInput>({
    ...empty,
    ...(initialCategory ? { category: initialCategory } : {}),
    ...(initialIndustry ? { industry: initialIndustry } : {}),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof BusinessInterviewInput>(
    key: K,
    value: BusinessInterviewInput[K],
  ) => setData((d) => ({ ...d, [key]: value }));

  // 카테고리별 질문 흐름. 카테고리 미선택 시 임시로 기본 흐름(길이 계산용).
  const steps = useMemo(
    () => buildSteps((data.category || "Other") as BusinessCategory, ko, t),
    [data.category, ko, t],
  );
  const TOTAL = 1 + steps.length;
  // 카테고리를 바꿔 스텝 수가 줄면 현재 스텝을 범위 내로 보정.
  const safeStep = Math.min(step, TOTAL);

  const pickCategory = (c: BusinessCategory) =>
    setData((d) => ({
      ...d,
      category: c,
      // 작가가 아니면 하위 유형 해제.
      writerKind: c === "Artist" ? d.writerKind : undefined,
    }));

  const canAdvance = (): boolean => {
    if (safeStep === 1)
      return (
        !!data.category &&
        (data.category !== "Artist" || !!data.writerKind)
      );
    const fs = steps[safeStep - 2];
    if (!fs) return false;
    switch (fs.kind) {
      case "text":
      case "textarea":
        return (data[fs.field] as string).trim().length > 0;
      case "tone":
        return !!data.tone;
      case "industry":
        return true; // 업종은 선택 사항
      default:
        return false;
    }
  };

  const next = () => {
    setError(null);
    if (!canAdvance()) {
      setError(t.required);
      return;
    }
    if (safeStep < TOTAL) setStep(safeStep + 1);
    else submit();
  };

  const back = () => {
    setError(null);
    if (safeStep > 1) setStep(safeStep - 1);
  };

  const submit = () => {
    startTransition(async () => {
      const res = await createBusinessAction(data);
      if (res.error || !res.businessId) {
        setError(res.error ?? "문제가 발생했습니다.");
        return;
      }
      router.push(`/business/${res.businessId}/brand?generate=1`);
    });
  };

  const fieldStep = safeStep >= 2 ? steps[safeStep - 2] : null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface/90 px-5 backdrop-blur sm:px-8">
        <Logo href="/dashboard" />
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          {t.later}
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-12">
        {/* Progress */}
        <div className="mb-10">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">
              {t.step}{" "}
              <span className="tnum text-foreground">{safeStep}</span> / {TOTAL}
            </p>
            <p className="eyebrow tnum">{Math.round((safeStep / TOTAL) * 100)}%</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${(safeStep / TOTAL) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1">
          {/* 1단계 — 카테고리 먼저 선택(작가면 하위 유형까지) */}
          {safeStep === 1 && (
            <StepShell
              title={t.q[1].t}
              hint={
                ko
                  ? "먼저 분야를 고르면, 그에 맞는 질문으로 진행돼요."
                  : "Pick your field — the next questions adapt to it."
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BUSINESS_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => pickCategory(c)}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150 active:translate-y-px",
                      data.category === c
                        ? "border-primary bg-primary-soft text-primary shadow-xs"
                        : "border-border-strong bg-surface text-foreground hover:border-muted/50 hover:bg-surface-muted",
                    )}
                  >
                    {t.categoryLabels[c]}
                  </button>
                ))}
              </div>

              {/* 작가 하위 유형 — 음악/미술/소설/기타 */}
              {data.category === "Artist" && (
                <div className="mt-6">
                  <p className="mb-2.5 text-sm font-medium text-foreground">
                    {ko ? "어떤 작가인가요?" : "What kind of artist?"}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {WRITER_KINDS.map((k) => (
                      <button
                        key={k}
                        onClick={() => set("writerKind", k as WriterKind)}
                        className={cn(
                          "rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150 active:translate-y-px",
                          data.writerKind === k
                            ? "border-primary bg-primary-soft text-primary shadow-xs"
                            : "border-border-strong bg-surface text-foreground hover:border-muted/50 hover:bg-surface-muted",
                        )}
                      >
                        {ko ? WRITER_KIND_LABELS[k].ko : WRITER_KIND_LABELS[k].en}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {ko
                      ? "선택한 유형에 맞는 미니멀 페이지(음악 앨범·미술 갤러리·글)가 자동으로 구성돼요."
                      : "We'll set up a minimal page tailored to your choice."}
                  </p>
                </div>
              )}
            </StepShell>
          )}

          {/* 이후 — 카테고리별 질문 */}
          {fieldStep && (
            <StepShell title={fieldStep.title} hint={fieldStep.hint}>
              {fieldStep.kind === "text" && (
                <Input
                  autoFocus
                  value={data[fieldStep.field] as string}
                  onChange={(e) => set(fieldStep.field, e.target.value)}
                  placeholder={fieldStep.placeholder}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                />
              )}
              {fieldStep.kind === "textarea" && (
                <Textarea
                  autoFocus
                  value={data[fieldStep.field] as string}
                  onChange={(e) => set(fieldStep.field, e.target.value)}
                  placeholder={fieldStep.placeholder}
                  className="min-h-24"
                />
              )}
              {fieldStep.kind === "tone" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {BRAND_TONES.map((tone) => (
                    <button
                      key={tone}
                      onClick={() => set("tone", tone)}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150 active:translate-y-px",
                        data.tone === tone
                          ? "border-primary bg-primary-soft text-primary shadow-xs"
                          : "border-border-strong bg-surface text-foreground hover:border-muted/50 hover:bg-surface-muted",
                      )}
                    >
                      {t.toneLabels[tone]}
                    </button>
                  ))}
                </div>
              )}
              {fieldStep.kind === "industry" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {INDUSTRIES.map((it) => (
                    <button
                      key={it.id}
                      onClick={() =>
                        set(
                          "industry",
                          (data.industry === it.id ? "" : it.id) as IndustryId,
                        )
                      }
                      className={cn(
                        "rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150 active:translate-y-px",
                        data.industry === it.id
                          ? "border-primary bg-primary-soft text-primary shadow-xs"
                          : "border-border-strong bg-surface text-foreground hover:border-muted/50 hover:bg-surface-muted",
                      )}
                    >
                      {t.industryLabels[it.id]}
                    </button>
                  ))}
                </div>
              )}
            </StepShell>
          )}

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={back}
            disabled={safeStep === 1 || pending}
            className={safeStep === 1 ? "invisible" : ""}
          >
            <Icon.arrowLeft width={18} height={18} />
            {t.back}
          </Button>
          <Button onClick={next} disabled={pending}>
            {pending ? (
              <Spinner />
            ) : safeStep === TOTAL ? (
              <>
                <Icon.sparkles width={18} height={18} />
                {t.create}
              </>
            ) : (
              t.next
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-[1.6rem] font-semibold leading-snug tracking-tight sm:text-[2rem]">
        {title}
      </h1>
      {hint && <p className="mt-2.5 text-muted">{hint}</p>}
      <div className="mt-7">{children}</div>
    </div>
  );
}
