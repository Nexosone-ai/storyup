"use client";

import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";

export interface StudioStep {
  n: number;
  label: string;
  hint?: string;
  done: boolean;
  /** 선행 단계가 안 돼 아직 열 수 없음(클릭 불가, 힌트 표시). */
  locked?: boolean;
  optional?: boolean;
}

/**
 * 콘텐츠 스튜디오 단계 헤더 — WorkflowSteps(서버 컴포넌트)의 마크업을 클라이언트용으로 복제.
 * 단계 클릭으로 전환하고, 완료/현재/잠김 상태를 보여준다.
 */
export function StepHeader({
  steps,
  current,
  onSelect,
  nextLabel,
}: {
  steps: StudioStep[];
  current: number;
  onSelect: (n: number) => void;
  /** '다음 단계' 안내 문구(없으면 숨김). */
  nextLabel?: string;
}) {
  const next = steps.find((s) => !s.done && !s.optional && s.n > current && !s.locked);
  return (
    <div
      data-tour="studio-steps"
      className="rounded-2xl border border-border bg-surface px-4 py-3.5 sm:px-5"
    >
      <ol className="flex items-center overflow-x-auto">
        {steps.map((s, i) => {
          const isCurrent = s.n === current;
          return (
            <li key={s.n} className={cn("flex items-center", i > 0 && "flex-1")}>
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 h-px min-w-3 flex-1 sm:mx-3",
                    steps[i - 1].done ? "bg-primary/50" : "bg-border",
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => !s.locked && onSelect(s.n)}
                disabled={s.locked}
                aria-current={isCurrent ? "step" : undefined}
                className="group flex shrink-0 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                title={s.hint}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors",
                    s.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border-strong text-muted group-hover:border-primary/50 group-hover:text-primary",
                  )}
                >
                  {s.done ? <Icon.check width={14} height={14} /> : s.n}
                </span>
                <span
                  className={cn(
                    "hidden text-sm font-medium md:inline",
                    isCurrent
                      ? "text-primary"
                      : s.done
                        ? "text-foreground"
                        : "text-muted group-hover:text-foreground",
                  )}
                >
                  {s.label}
                  {s.optional && (
                    <span className="ml-1 text-[10px] font-normal text-muted">(선택)</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {/* 모바일: 현재 단계 라벨만 */}
      <p className="mt-2 text-sm font-medium text-primary md:hidden">
        STEP {current} · {steps.find((s) => s.n === current)?.label}
      </p>
      {next && nextLabel && (
        <p className="mt-2.5 border-t border-border pt-2.5 text-xs text-muted">
          {nextLabel}:{" "}
          <button
            type="button"
            data-tour="studio-next"
            onClick={() => onSelect(next.n)}
            className="font-medium text-primary hover:underline"
          >
            STEP {next.n} · {next.label}
            {next.hint ? ` — ${next.hint}` : ""} →
          </button>
        </p>
      )}
    </div>
  );
}
