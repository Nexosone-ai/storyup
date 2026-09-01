import Link from "next/link";
import { getWorkflowState } from "@/lib/queries";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";

interface StepDef {
  n: 1 | 2 | 3 | 4;
  label: string;
  href: string;
  done: boolean;
  hint: string;
}

/**
 * 브랜드 스토리 → 홈페이지 → 블로그 → SNS 4단계 진행 스트립.
 * 각 작업 페이지 상단에 붙여 현재 단계와 다음 할 일을 보여준다.
 */
export async function WorkflowSteps({
  businessId,
  current,
}: {
  businessId: string;
  current: 1 | 2 | 3 | 4;
}) {
  const state = await getWorkflowState(businessId);
  const base = `/business/${businessId}`;

  const steps: StepDef[] = [
    {
      n: 1,
      label: "브랜드 스토리",
      href: `${base}/brand`,
      done: state.brand,
      hint: "이야기로 브랜드 만들기",
    },
    {
      n: 2,
      label: "홈페이지",
      href: `${base}/website`,
      done: state.website === "published",
      hint:
        state.website === "draft" ? "편집 중 · 공개 전" : "홈페이지 만들고 공개",
    },
    {
      n: 3,
      label: "블로그",
      href: `${base}/blog`,
      done: state.blogPublished > 0,
      hint: state.blogTotal > 0 ? "글 공개하기" : "첫 글 쓰기",
    },
    {
      n: 4,
      label: "SNS",
      href: `${base}/marketing`,
      done: state.sns,
      hint: "SNS 콘텐츠 만들기",
    },
  ];

  const next = steps.find((s) => !s.done);

  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3.5 sm:px-5">
      <ol className="flex items-center">
        {steps.map((s, i) => {
          const isCurrent = s.n === current;
          return (
            <li key={s.n} className={cn("flex items-center", i > 0 && "flex-1")}>
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 h-px flex-1 sm:mx-3",
                    steps[i - 1].done ? "bg-primary/50" : "bg-border",
                  )}
                />
              )}
              <Link
                href={s.href}
                aria-current={isCurrent ? "step" : undefined}
                className="group flex shrink-0 items-center gap-2"
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
                    "hidden text-sm font-medium sm:inline",
                    isCurrent
                      ? "text-primary"
                      : s.done
                        ? "text-foreground"
                        : "text-muted group-hover:text-foreground",
                  )}
                >
                  {s.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {next && next.n !== current && (
        <p className="mt-2.5 border-t border-border pt-2.5 text-xs text-muted">
          다음 단계:{" "}
          <Link href={next.href} className="font-medium text-primary">
            STEP {next.n} · {next.label} — {next.hint} →
          </Link>
        </p>
      )}
    </div>
  );
}
