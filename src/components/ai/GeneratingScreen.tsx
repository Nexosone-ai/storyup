"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";

/**
 * Full-panel loading state that walks through staged messages while an AI
 * generation is in flight. Shows completed steps with checks and a retry
 * affordance on error.
 */
export function GeneratingScreen({
  title,
  steps,
  error,
  onRetry,
}: {
  title: string;
  steps: string[];
  error?: string | null;
  onRetry?: () => void;
}) {
  const ko = useLocale() === "ko";
  const [i, setI] = useState(0);

  useEffect(() => {
    if (error) return;
    const t = setInterval(() => {
      setI((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1900);
    return () => clearInterval(t);
  }, [error, steps.length]);

  if (error) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-danger/10 text-danger">
            <Icon.x className="size-5" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            {ko ? "잠시 문제가 있었어요" : "Something went wrong"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{error}</p>
          {onRetry && (
            <Button className="mt-6" onClick={onRetry}>
              {ko ? "다시 시도하기" : "Try again"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon.sparkles className="size-5" />
            <span className="absolute inset-0 animate-ping rounded-xl bg-primary/10" />
          </span>
          <h2 className="text-base font-semibold tracking-tight text-balance">
            {title}
          </h2>
        </div>

        <ol className="mt-7 space-y-1">
          {steps.map((s, idx) => {
            const done = idx < i;
            const active = idx === i;
            return (
              <li
                key={s}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active && "bg-surface-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] transition-colors",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                        ? "border-primary text-primary"
                        : "border-border text-muted",
                  )}
                >
                  {done ? (
                    <Icon.check className="size-3" />
                  ) : active ? (
                    <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  ) : null}
                </span>
                <span
                  className={cn(
                    done
                      ? "text-muted"
                      : active
                        ? "font-medium text-foreground"
                        : "text-muted/70",
                  )}
                >
                  {s}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
