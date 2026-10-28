import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { getLocale } from "@/lib/i18n";
import { getUser } from "@/lib/queries";
import {
  getPublishedIndustry,
  channelLabel,
  industryName,
} from "@/lib/industries";
import { buildSeo, siteUrl } from "@/utils/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getPublishedIndustry(slug);
  if (!detail) return buildSeo({ title: "업종별 활용", path: `/industries/${slug}` });
  const seo = (detail.row.seo ?? {}) as {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  return buildSeo({
    title: seo.title || `${detail.summary.nameKo} 스토리업 활용`,
    description:
      seo.description || detail.summary.summaryKo || detail.content?.sub,
    keywords: seo.keywords,
    path: `/industries/${slug}`,
  });
}

export default async function IndustryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ko = (await getLocale()) === "ko";
  const detail = await getPublishedIndustry(slug);
  if (!detail) notFound();
  const { summary, content } = detail;
  const name = industryName(summary, ko);

  // '이 업종으로 시작하기' — 선택 업종을 유지한 채 기존 제작 흐름으로. 자동 생성/과금 없음.
  const user = await getUser();
  const onboardingPath = `/onboarding?industry=${encodeURIComponent(slug)}`;
  const startHref = user
    ? onboardingPath
    : `/login?redirect=${encodeURIComponent(onboardingPath)}`;

  // 구조화 데이터 — 표시 내용과 일치하는 Breadcrumb + FAQ만.
  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "업종별 활용", item: `${siteUrl}/industries` },
        { "@type": "ListItem", position: 2, name: summary.nameKo, item: `${siteUrl}/industries/${slug}` },
      ],
    },
  ];
  if (content && content.faq.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: content.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1 px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <nav className="text-xs text-muted">
            <Link href="/industries" className="hover:text-foreground">
              {ko ? "업종별 활용" : "By industry"}
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">{name}</span>
          </nav>

          {/* ① 전용 제목·설명·대표 시각 */}
          <header className="mt-5">
            <div aria-hidden className="text-5xl">
              {summary.icon}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {content?.headline ?? name}
            </h1>
            {content?.sub && (
              <p className="mt-3 text-lg text-muted">{content.sub}</p>
            )}
          </header>

          {/* 전문 분야 검토 안내(의료·금융·디지털자산·부동산·네트워크마케팅 등) */}
          {summary.sensitive && (
            <p className="mt-5 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning">
              {ko
                ? "이 업종은 관련 법규·광고 심의가 적용될 수 있어요. 효과·수익·실적·자격을 단정하거나 보장하지 않으며, 발행 전 전문가·담당자의 검토가 필요합니다."
                : "This industry may be subject to regulations and ad review. We never guarantee outcomes; expert review is required before publishing."}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={startHref}
              className="neon-glow inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {ko ? "이 업종으로 시작하기" : "Start with this industry"}
            </Link>
            <Link
              href="/industries/request"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-6 text-sm font-semibold transition-colors hover:border-primary"
            >
              {ko ? "업종 추가 요청" : "Request an industry"}
            </Link>
          </div>

          {content && (
            <>
              {/* ② 대표 고민 3가지 */}
              <Section title={ko ? "이런 고민, 있으시죠?" : "Common challenges"}>
                <ul className="space-y-2.5">
                  {content.concerns.map((c, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                    >
                      “{c}”
                    </li>
                  ))}
                </ul>
              </Section>

              {/* ③ 활용 흐름 */}
              <Section title={ko ? "스토리업 활용 흐름" : "How it works"}>
                <ol className="grid gap-3 sm:grid-cols-3">
                  {content.flow.map((s, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-border bg-surface p-4"
                    >
                      <span className="text-xs font-bold text-primary">
                        STEP {i + 1}
                      </span>
                      <p className="mt-1 text-sm font-semibold">{s.title}</p>
                      <p className="mt-1 text-sm text-muted">{s.desc}</p>
                    </li>
                  ))}
                </ol>
              </Section>

              {/* ④ 채널별 활용 예시 */}
              <Section title={ko ? "이렇게 활용해요" : "Use it across channels"}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {content.channels.map((c, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-surface p-4"
                    >
                      <span className="inline-block rounded bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted">
                        {channelLabel(c.kind)}
                      </span>
                      <p className="mt-2 text-sm font-semibold">{c.title}</p>
                      <p className="mt-1 text-sm text-muted">{c.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">
                  {ko
                    ? "※ 영상·외부 SNS 자동 연동·예약 자동발행 등 일부 기능은 요금제·계정 상태에 따라 제공 범위가 다를 수 있어요."
                    : "※ Video and external SNS integrations may vary by plan and account."}
                </p>
              </Section>

              {/* ⑤ 입력 정보 + 콘텐츠 주제 예시 */}
              <Section title={ko ? "무엇을 넣고, 무엇을 만드나요" : "Inputs & topics"}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-sm font-semibold">
                      {ko ? "입력 정보 예시" : "Example inputs"}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {content.inputs.map((x, i) => (
                        <li
                          key={i}
                          className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs text-muted"
                        >
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-sm font-semibold">
                      {ko ? "콘텐츠 주제 예시" : "Example topics"}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {content.topics.map((x, i) => (
                        <li
                          key={i}
                          className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs text-muted"
                        >
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Section>

              {/* ⑥ 가상 예시 샘플 */}
              <Section title={ko ? "예시로 보기" : "Sample"}>
                <div className="rounded-xl border border-border bg-surface p-5">
                  <span className="inline-block rounded bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                    {ko ? "가상 예시" : "Sample (illustrative)"}
                  </span>
                  <p className="mt-2 text-base font-semibold">
                    {content.sample.title}
                  </p>
                  <p className="mt-1.5 text-sm text-muted">
                    {content.sample.body}
                  </p>
                </div>
              </Section>

              {/* 하위 분류 안내(선택) */}
              {content.subtypes && content.subtypes.length > 0 && (
                <Section title={ko ? "세부 유형" : "Sub-types"}>
                  <div className="flex flex-wrap gap-1.5">
                    {content.subtypes.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-border bg-surface px-3 py-1 text-xs"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {ko
                      ? "원하는 세부 유형이 있으면 업종 추가 요청으로 알려주세요."
                      : "Request a specific sub-type if you need one."}
                  </p>
                </Section>
              )}

              {/* ⑦ FAQ */}
              {content.faq.length > 0 && (
                <Section title={ko ? "자주 묻는 질문" : "FAQ"}>
                  <div className="space-y-2">
                    {content.faq.map((f, i) => (
                      <details
                        key={i}
                        className="rounded-xl border border-border bg-surface p-4"
                      >
                        <summary className="cursor-pointer text-sm font-semibold">
                          {f.q}
                        </summary>
                        <p className="mt-2 text-sm text-muted">{f.a}</p>
                      </details>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {/* ⑧ 하단 CTA */}
          <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-muted p-6 text-center">
            <p className="text-lg font-semibold">
              {ko ? `${name}, 지금 시작해볼까요?` : `Ready to start?`}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={startHref}
                className="neon-glow inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {ko ? "이 업종으로 시작하기" : "Start with this industry"}
              </Link>
              <Link
                href="/industries/request"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-6 text-sm font-semibold transition-colors hover:border-primary"
              >
                {ko ? "업종 추가 요청" : "Request an industry"}
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
