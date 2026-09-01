import { notFound } from "next/navigation";
import Link from "next/link";
import { getBusiness, getWebsite, getWorkflowState } from "@/lib/queries";
import { Badge } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";

export const metadata = { title: "비즈니스 개요" };

export default async function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  const [website, state] = await Promise.all([
    getWebsite(id),
    getWorkflowState(id),
  ]);

  const base = `/business/${id}`;
  const steps = [
    {
      n: 1,
      label: "브랜드 스토리",
      desc: "당신의 이야기를 AI가 브랜드로 완성합니다.",
      done: state.brand,
      partial: false,
      href: `${base}/brand`,
      icon: Icon.sparkles,
      cta: state.brand ? "보기·수정" : "만들기",
    },
    {
      n: 2,
      label: "홈페이지",
      desc: "브랜드 스토리로 홈페이지를 만들고 공개하세요.",
      done: state.website === "published",
      partial: state.website === "draft",
      href: `${base}/website`,
      icon: Icon.globe,
      cta:
        state.website === "published"
          ? "관리"
          : state.website === "draft"
            ? "편집·공개"
            : "만들기",
    },
    {
      n: 3,
      label: "블로그",
      desc: "검색에 잘 걸리는 블로그 글을 AI와 함께 씁니다.",
      done: state.blogPublished > 0,
      partial: state.blogTotal > 0,
      href: `${base}/blog`,
      icon: Icon.pen,
      cta: state.blogTotal > 0 ? "관리" : "첫 글 쓰기",
    },
    {
      n: 4,
      label: "SNS",
      desc: "블로그 글을 SNS 게시물과 카드뉴스로 바꿔 공유하세요.",
      done: state.sns,
      partial: false,
      href: `${base}/marketing`,
      icon: Icon.megaphone,
      cta: state.sns ? "관리" : "만들기",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">워크스페이스</p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold uppercase tracking-tight sm:text-3xl">
              {business.name}
            </h1>
            {website?.status === "published" ? (
              <Badge tone="success">
                <span className="size-1.5 rounded-full bg-primary" />
                공개됨
              </Badge>
            ) : (
              <Badge tone="muted">비공개</Badge>
            )}
          </div>
          <p className="mt-1.5 text-muted">{business.category}</p>
        </div>
        {website?.status === "published" && (
          <ButtonLink
            href={`/site/${website.slug}`}
            variant="outline"
            size="sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon.external width={16} height={16} />
            공개 홈페이지 열기
          </ButtonLink>
        )}
      </div>

      {/* STEP 진행 요약 */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            브랜드 만들기 <span className="tnum text-primary">{doneCount}</span>
            <span className="text-muted">/4 단계 완료</span>
          </p>
          {next && (
            <Link
              href={next.href}
              className="text-sm font-medium text-primary hover:underline"
            >
              다음: STEP {next.n} · {next.label} →
            </Link>
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${(doneCount / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* STEP 목록 */}
      <ol className="space-y-3">
        {steps.map((s) => {
          const StepIcon = s.icon;
          const isNext = next?.n === s.n;
          return (
            <li key={s.n}>
              <Link href={s.href} className="group block">
                <div
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border bg-surface p-5 transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md",
                    isNext
                      ? "border-primary/50 shadow-sm"
                      : "border-border group-hover:border-border-strong",
                  )}
                >
                  <div
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold",
                      s.done
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary-soft text-primary",
                    )}
                  >
                    {s.done ? <Icon.check width={16} height={16} /> : s.n}
                  </div>
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary max-sm:hidden">
                    <StepIcon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold tracking-tight">
                        STEP {s.n} · {s.label}
                      </p>
                      {isNext && !s.done && (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                          다음 할 일
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {s.done ? "완료" : s.partial ? "진행 중" : s.desc}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-primary">
                    {s.cta} →
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
