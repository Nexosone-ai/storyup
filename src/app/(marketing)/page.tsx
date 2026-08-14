import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import Link from "next/link";

const STEPS = [
  { no: "01", title: "STORY", desc: "당신의 사업 이야기를 들려주세요." },
  { no: "02", title: "BRAND", desc: "AI가 브랜드 스토리를 만듭니다." },
  { no: "03", title: "WEBSITE", desc: "몇 분 안에 비즈니스 홈페이지를 만듭니다." },
  { no: "04", title: "CONTENT", desc: "블로그 콘텐츠를 생성합니다." },
  { no: "05", title: "GROW", desc: "온라인에서 고객을 만날 준비를 합니다." },
];

const FEATURES = [
  {
    icon: Icon.sparkles,
    title: "AI 브랜드 스토리",
    desc: "몇 가지 질문에 답하면 진정성 있는 브랜드 스토리와 슬로건이 완성됩니다.",
  },
  {
    icon: Icon.globe,
    title: "자동 홈페이지 생성",
    desc: "전문 지식 없이도 바로 공개할 수 있는 비즈니스 홈페이지를 만듭니다.",
  },
  {
    icon: Icon.pen,
    title: "블로그 & 마케팅 콘텐츠",
    desc: "블로그 글을 쓰고 인스타·페이스북 게시물로 바로 바꿔보세요.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      {/* Hero — thesis */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-20 pb-20 sm:px-8 sm:pt-28">
        <div className="max-w-3xl">
          <p className="eyebrow mb-5">AI 비즈니스 브랜딩 플랫폼</p>
          <h1 className="text-[2.75rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            당신의 이야기를
            <br />
            <span className="text-primary">비즈니스</span>로.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            사업 이야기를 들려주세요. AI가 브랜드, 홈페이지, 블로그 콘텐츠로
            만들어드립니다.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/signup" size="lg">
              무료로 시작하기
              <Icon.arrowLeft className="size-4 rotate-180" />
            </ButtonLink>
            <Link
              href="#how"
              className="inline-flex h-12 items-center justify-center rounded-lg px-5 text-[0.95rem] font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              어떻게 작동하나요?
            </Link>
          </div>
        </div>
      </section>

      {/* Process — editorial numbered index (a real sequence) */}
      <section id="how" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <p className="eyebrow mb-3">작동 방식</p>
          <h2 className="mb-10 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            이야기 하나가 온라인 비즈니스가 되기까지
          </h2>
          <ol className="grid divide-y divide-border border-t border-border sm:grid-cols-5 sm:divide-x sm:divide-y-0">
            {STEPS.map((s) => (
              <li key={s.no} className="py-6 sm:px-4 sm:py-2 sm:pt-0">
                <div className="eyebrow mb-3 text-primary">{s.no}</div>
                <div className="mb-1.5 text-base font-semibold tracking-tight">
                  {s.title}
                </div>
                <p className="text-sm leading-relaxed text-muted">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features — container-lines, not floating cards */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid overflow-hidden rounded-2xl border border-border md:grid-cols-3">
          {FEATURES.map((f, i) => {
            const FeatureIcon = f.icon;
            return (
              <div
                key={f.title}
                className={cnBorder(i)}
              >
                <div className="mb-4 grid size-10 place-items-center rounded-lg bg-primary-soft text-primary">
                  <FeatureIcon className="size-[20px]" />
                </div>
                <h3 className="mb-2 text-lg font-semibold tracking-tight">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mb-24 w-full max-w-6xl px-5 sm:px-8">
        <div className="rounded-3xl border border-border bg-surface px-8 py-16 text-center">
          <h2 className="mx-auto max-w-lg text-2xl font-semibold tracking-tight sm:text-[2rem]">
            지금 바로 시작해보세요
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted">
            사업 이야기 하나면 충분합니다. STORYUP이 브랜드와 콘텐츠로
            만들어드립니다.
          </p>
          <div className="mt-8">
            <ButtonLink href="/signup" size="lg">
              무료로 시작하기
            </ButtonLink>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/** Shared container-line borders between feature cells. */
function cnBorder(i: number): string {
  const bottom = "border-b border-border md:border-b-0";
  const right = i < 2 ? "md:border-r md:border-border" : "";
  const last = i === 2 ? "border-b-0" : "";
  return `p-7 ${bottom} ${right} ${last}`;
}
