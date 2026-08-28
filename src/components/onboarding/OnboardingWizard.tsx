"use client";

import { useState, useTransition } from "react";
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
  type BusinessInterviewInput,
  type BusinessCategory,
  type BrandTone,
} from "@/types/domain";
import type { Dict } from "@/lib/i18n";

type OnbDict = Dict["onboarding"];
const TOTAL = 6;

const empty: BusinessInterviewInput = {
  name: "",
  category: "" as BusinessCategory,
  founder_story: "",
  target_customer: "",
  strengths: "",
  tone: "" as BrandTone,
};

export function OnboardingWizard({ t }: { t: OnbDict }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<BusinessInterviewInput>(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof BusinessInterviewInput>(
    key: K,
    value: BusinessInterviewInput[K],
  ) => setData((d) => ({ ...d, [key]: value }));

  const canAdvance = (): boolean => {
    switch (step) {
      case 1:
        return data.name.trim().length > 0;
      case 2:
        return !!data.category;
      case 3:
        return data.founder_story.trim().length > 0;
      case 4:
        return data.target_customer.trim().length > 0;
      case 5:
        return data.strengths.trim().length > 0;
      case 6:
        return !!data.tone;
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
    if (step < TOTAL) setStep((s) => s + 1);
    else submit();
  };

  const back = () => {
    setError(null);
    if (step > 1) setStep((s) => s - 1);
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
              {t.step} <span className="tnum text-foreground">{step}</span> / {TOTAL}
            </p>
            <p className="eyebrow tnum">
              {Math.round((step / TOTAL) * 100)}%
            </p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${(step / TOTAL) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex-1">
          {step === 1 && (
            <StepShell
              title={t.q[0].t}
              hint={t.q[0].h || undefined}
            >
              <Input
                autoFocus
                value={data.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t.q[0].p}
                onKeyDown={(e) => e.key === "Enter" && next()}
              />
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title={t.q[1].t}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BUSINESS_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => set("category", c)}
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
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title={t.q[2].t}>
              <Textarea
                autoFocus
                value={data.founder_story}
                onChange={(e) => set("founder_story", e.target.value)}
                placeholder={t.q[2].p}
              />
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title={t.q[3].t}>
              <Textarea
                autoFocus
                value={data.target_customer}
                onChange={(e) => set("target_customer", e.target.value)}
                placeholder={t.q[3].p}
                className="min-h-24"
              />
            </StepShell>
          )}

          {step === 5 && (
            <StepShell title={t.q[4].t}>
              <Textarea
                autoFocus
                value={data.strengths}
                onChange={(e) => set("strengths", e.target.value)}
                placeholder={t.q[4].p}
                className="min-h-24"
              />
            </StepShell>
          )}

          {step === 6 && (
            <StepShell title={t.q[5].t}>
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
            </StepShell>
          )}

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 1 || pending}
            className={step === 1 ? "invisible" : ""}
          >
            <Icon.arrowLeft width={18} height={18} />
            {t.back}
          </Button>
          <Button onClick={next} disabled={pending}>
            {pending ? (
              <Spinner />
            ) : step === TOTAL ? (
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
