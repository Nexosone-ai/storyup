import { notFound } from "next/navigation";
import Link from "next/link";
import { getBusiness, getWebsite, getBlogPosts } from "@/lib/queries";
import { getAnalytics, getCustomerInsights } from "@/lib/analytics";
import { getLocale } from "@/lib/i18n";
import { computeSeoReport } from "@/utils/seoScore";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { SeoAudit, type SeoAuditItem } from "@/components/blog/SeoAudit";
import { TrendChart } from "@/components/analytics/TrendChart";

export const metadata = { title: "애널리틱스" };

function channelLabel(channel: string, ko: boolean): string {
  const labels: Record<string, string> = {
    x: "X",
    facebook: "Facebook",
    link: ko ? "링크 복사" : "Link copied",
  };
  return labels[channel] ?? channel;
}

/** /site/slug/... 경로를 사람이 읽는 페이지 이름으로 바꾼다. */
function pathLabel(
  path: string,
  slugToTitle: Map<string, string>,
  ko: boolean,
): string {
  const m = path.match(/^\/site\/[^/]+(?:\/(.*))?$/);
  if (!m) return path;
  const rest = m[1] ?? "";
  if (!rest) return ko ? "홈" : "Home";
  if (rest === "blog") return ko ? "블로그 목록" : "Blog index";
  const post = rest.match(/^blog\/(.+)$/);
  if (post)
    return `${ko ? "글" : "Post"} · ${slugToTitle.get(post[1]) ?? post[1]}`;
  return path;
}

/** 증감율 배지 (▲ 초록 / ▼ 빨강 / – 회색) */
function GrowthBadge({ pct, ko }: { pct: number; ko: boolean }) {
  const up = pct > 0;
  const down = pct < 0;
  const cls = up
    ? "bg-emerald-50 text-emerald-600"
    : down
      ? "bg-rose-50 text-rose-600"
      : "bg-surface-muted text-muted";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${cls}`}
      title={ko ? "직전 30일 대비" : "vs previous 30 days"}
    >
      {up ? "▲" : down ? "▼" : "–"} {Math.abs(pct)}%
    </span>
  );
}

/** 쿠폰 사용률 도넛 */
function UsageDonut({ rate }: { rate: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, rate)) / 100);
  return (
    <svg viewBox="0 0 100 100" className="size-28 shrink-0">
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-surface-muted"
        strokeWidth="10"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-primary"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[20px] font-bold"
      >
        {rate}%
      </text>
    </svg>
  );
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ko = (await getLocale()) === "ko";
  const business = await getBusiness(id);
  if (!business) notFound();

  const [website, posts, data, insights] = await Promise.all([
    getWebsite(id),
    getBlogPosts(id),
    getAnalytics(id),
    getCustomerInsights(id),
  ]);

  const slugToTitle = new Map(posts.map((p) => [p.slug, p.title]));
  const published = website?.status === "published";
  const { coupon, leads } = insights;

  // 글별 SEO 자가진단
  const seoItems: SeoAuditItem[] = posts.map((p) => ({
    postId: p.id,
    title: p.title,
    status: p.status,
    editHref: `/business/${id}/blog/${p.id}`,
    report: computeSeoReport({
      title: p.title,
      summary: p.summary ?? "",
      seoTitle: p.seo_title,
      seoDescription: p.seo_description,
      keywords: p.keywords ?? [],
      content: p.content ?? "",
      hasCoverImage: !!p.cover_image_url,
    }),
  }));

  // ---- 맞춤 제안(규칙 기반) ----
  const tips: string[] = [];
  if (coupon.issued === 0)
    tips.push(
      ko
        ? "아직 쿠폰 이벤트가 없어요. 블로그 글에 쿠폰을 달면 방문자의 이름·연락처를 모아 단골로 만들 수 있어요."
        : "No coupon events yet. Add a coupon to a blog post to collect visitors' names and contacts.",
    );
  if (coupon.issued > 0 && coupon.usageRate < 30)
    tips.push(
      ko
        ? `쿠폰 사용률이 ${coupon.usageRate}%로 낮아요. 사용 기간을 늘리거나 혜택을 강화하고, 발급 고객에게 안내 문자를 보내보세요.`
        : `Coupon usage is only ${coupon.usageRate}%. Extend the validity or boost the benefit, and remind claimants.`,
    );
  if (coupon.byPost[0])
    tips.push(
      ko
        ? `‘${coupon.byPost[0].title}’ 글에서 쿠폰이 가장 많이 발행됐어요(${coupon.byPost[0].issued}건). 비슷한 주제의 글을 더 써보세요.`
        : `‘${coupon.byPost[0].title}’ issued the most coupons (${coupon.byPost[0].issued}). Write more on similar topics.`,
    );
  if (leads.growthPct < 0)
    tips.push(
      ko
        ? "최근 신규 고객이 줄고 있어요. 새 쿠폰 이벤트를 열거나 블로그 글을 발행해 유입을 늘려보세요."
        : "New customers are declining. Launch a new coupon event or publish a post to drive traffic.",
    );
  else if (leads.new30d > 0)
    tips.push(
      ko
        ? `최근 30일 신규 고객이 ${leads.new30d}명이에요(${leads.growthPct >= 0 ? "+" : ""}${leads.growthPct}%). 이 흐름을 이어가세요.`
        : `${leads.new30d} new customers in 30 days (${leads.growthPct >= 0 ? "+" : ""}${leads.growthPct}%). Keep it up.`,
    );
  if (data.viewsGrowthPct < 0)
    tips.push(
      ko
        ? "방문이 감소 추세예요. 새 블로그 글과 SNS 공유로 유입 경로를 넓혀보세요."
        : "Visits are trending down. Add new posts and share on social to widen your reach.",
    );
  if (data.shares30d === 0 && data.views30d > 0)
    tips.push(
      ko
        ? "공유가 아직 없어요. 글 하단 공유 버튼을 눌러 직접 퍼뜨려 보세요."
        : "No shares yet. Use the share buttons under your posts to spread the word.",
    );
  const suggestions = tips.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-2">{ko ? "애널리틱스" : "Analytics"}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "고객·방문 인사이트" : "Customer & traffic insights"}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "방문자 증감, 쿠폰 성과, 새로 모인 고객을 한눈에 보고 다음 액션을 정하세요."
            : "See visitor growth, coupon performance, and new customers at a glance."}
        </p>
      </div>

      {!published && (
        <Card className="flex items-start gap-4 border-dashed bg-surface">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted">
            <Icon.chart className="size-5" />
          </div>
          <p className="text-sm text-muted">
            {ko
              ? "랜딩페이지가 아직 공개되지 않았습니다. 공개하면 방문자 지표가 수집되기 시작합니다."
              : "Your landing page is not published yet. Visitor metrics start collecting once you publish."}
          </p>
        </Card>
      )}

      {/* 핵심 지표 + 증감율 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">
            {ko ? "조회수 (30일)" : "Views (30d)"}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="tnum text-3xl font-semibold tracking-tight">
              {data.views30d.toLocaleString()}
            </p>
            <GrowthBadge pct={data.viewsGrowthPct} ko={ko} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {ko ? "직전 30일" : "prev"} {data.viewsPrev30d.toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">
            {ko ? "신규 고객 (30일)" : "New customers (30d)"}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="tnum text-3xl font-semibold tracking-tight">
              {leads.new30d.toLocaleString()}
            </p>
            <GrowthBadge pct={leads.growthPct} ko={ko} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {ko ? "누적" : "total"} {leads.total.toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">
            {ko ? "쿠폰 사용률" : "Coupon usage"}
          </p>
          <p className="tnum mt-2 text-3xl font-semibold tracking-tight">
            {coupon.usageRate}%
          </p>
          <p className="mt-1 text-xs text-muted">
            {ko
              ? `${coupon.used} / ${coupon.issued}건 사용`
              : `${coupon.used} / ${coupon.issued} used`}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">
            {ko ? "공유 (30일)" : "Shares (30d)"}
          </p>
          <p className="tnum mt-2 text-3xl font-semibold tracking-tight">
            {data.shares30d.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted">
            {ko ? "전체 조회 " : "all-time views "}
            {data.totalViews.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* 방문 추이 그래프 */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold tracking-tight">
            {ko ? "방문 추이 (최근 30일)" : "Visits (last 30 days)"}
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{ko ? "최근 7일" : "Last 7d"}</span>
            <span className="tnum font-semibold text-foreground">
              {data.views7d}
            </span>
            <GrowthBadge pct={data.views7dGrowthPct} ko={ko} />
          </div>
        </div>
        <TrendChart data={data.trend} ko={ko} />
      </Card>

      {/* 쿠폰 성과 + 고객 리드 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold tracking-tight">
            {ko ? "쿠폰 성과" : "Coupon performance"}
          </h2>
          {coupon.issued === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              {ko
                ? "아직 발행된 쿠폰이 없어요. 블로그 글 편집에서 이벤트를 켜보세요."
                : "No coupons issued yet. Turn on an event in the blog editor."}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-5">
                <UsageDonut rate={coupon.usageRate} />
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted">
                      {ko ? "발행 " : "Issued "}
                    </span>
                    <b className="tnum">{coupon.issued}</b>
                  </p>
                  <p>
                    <span className="text-muted">
                      {ko ? "사용 " : "Used "}
                    </span>
                    <b className="tnum">{coupon.used}</b>
                  </p>
                  <p>
                    <span className="text-muted">
                      {ko ? "미사용 " : "Unused "}
                    </span>
                    <b className="tnum">{coupon.issued - coupon.used}</b>
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2.5 text-sm font-medium text-muted">
                  {ko ? "게시글별 쿠폰 발행" : "Coupons by post"}
                </p>
                <ul className="space-y-2.5">
                  {coupon.byPost.slice(0, 5).map((p) => (
                    <li key={p.postId ?? p.title} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {p.title}
                      </span>
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted">
                        <span
                          className="block h-full rounded-full bg-primary/70"
                          style={{
                            width: `${(p.issued / coupon.byPost[0].issued) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="tnum w-16 text-right text-xs text-muted">
                        {ko
                          ? `${p.issued}발행·${p.used}사용`
                          : `${p.issued}/${p.used}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold tracking-tight">
            {ko ? "새로 모인 고객" : "Customers gained"}
          </h2>
          <div className="flex items-baseline gap-2">
            <p className="tnum text-4xl font-semibold tracking-tight">
              {leads.total.toLocaleString()}
            </p>
            <span className="text-sm text-muted">{ko ? "명 누적" : "total"}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted">
            <span>
              {ko ? "최근 30일 " : "30d "}
              <b className="tnum text-foreground">{leads.new30d}</b>
            </span>
            <GrowthBadge pct={leads.growthPct} ko={ko} />
          </div>

          <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">
                🎟 {ko ? "쿠폰으로 유입" : "Via coupons"}
              </span>
              <b className="tnum">{leads.viaCoupon}</b>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">
                📞 {ko ? "문의로 유입" : "Via inquiries"}
              </span>
              <b className="tnum">{leads.viaInquiry}</b>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <Link
              href="/dashboard/inquiries/coupons"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary"
            >
              {ko ? "쿠폰 수령자 보기" : "View coupon claims"}
            </Link>
            <Link
              href="/dashboard/inquiries"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary"
            >
              {ko ? "문의 보기" : "View inquiries"}
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">
            {ko
              ? "고객 이름·연락처는 ‘문의/쿠폰관리’에서 확인하고 답변·안내할 수 있어요."
              : "Names and contacts are available under ‘Inquiries & coupons’."}
          </p>
        </Card>
      </div>

      {/* 맞춤 제안 */}
      {suggestions.length > 0 && (
        <Card className="border-primary/25 bg-primary-soft/30">
          <h2 className="mb-3 flex items-center gap-2 font-semibold tracking-tight">
            <Icon.sparkles width={18} height={18} className="text-primary" />
            {ko ? "맞춤 제안" : "Suggestions for you"}
          </h2>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-foreground/90">{s}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 페이지별 조회 + 유입 경로 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold tracking-tight">
            {ko ? "페이지별 조회수 (30일)" : "Views by page (30 days)"}
          </h2>
          {data.topPaths.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {ko ? "아직 수집된 조회가 없습니다." : "No views collected yet."}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {data.topPaths.map((p) => (
                <li key={p.path} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {pathLabel(p.path, slugToTitle, ko)}
                  </span>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className="block h-full rounded-full bg-primary/70"
                      style={{
                        width: `${(p.views / data.topPaths[0].views) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="tnum w-10 text-right text-sm font-medium">
                    {p.views}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold tracking-tight">
            {ko ? "유입 경로 (30일)" : "Referrers (30 days)"}
          </h2>
          <p className="mb-4 text-xs text-muted">
            {ko
              ? "방문자가 어떤 경로로 들어왔는지 (검색·SNS·직접 방문 등)"
              : "Where visitors came from (search, social, direct, …)"}
          </p>
          {data.referrers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {ko ? "아직 수집된 유입이 없습니다." : "No referrers collected yet."}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {data.referrers.map((r) => (
                <li key={r.source} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {r.source}
                  </span>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className="block h-full rounded-full bg-primary/70"
                      style={{
                        width: `${(r.count / data.referrers[0].count) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="tnum w-10 text-right text-sm font-medium">
                    {r.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 공유 현황 */}
      <Card>
        <h2 className="mb-4 font-semibold tracking-tight">
          {ko ? "콘텐츠 공유 (30일)" : "Content shares (30 days)"}
        </h2>
        {data.shareByChannel.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {ko
              ? "아직 공유 기록이 없습니다. 블로그 글과 카드뉴스의 공유 버튼이 여기에 집계됩니다."
              : "No shares yet. Share buttons on blog posts and card news are counted here."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {data.shareByChannel.map((s) => (
              <div
                key={s.channel}
                className="flex items-center gap-2.5 rounded-xl border border-border px-4 py-2.5"
              >
                {s.channel === "x" ? (
                  <Icon.xBrand width={15} height={15} />
                ) : s.channel === "facebook" ? (
                  <Icon.facebookBrand width={16} height={16} />
                ) : (
                  <Icon.link width={16} height={16} />
                )}
                <span className="text-sm">{channelLabel(s.channel, ko)}</span>
                <span className="tnum text-sm font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 준비 중 — 방문자 식별이 필요한 지표 */}
      <Card className="border-dashed bg-surface">
        <h2 className="mb-1 flex items-center gap-2 font-semibold tracking-tight">
          <Icon.chart className="size-4 text-muted" />
          {ko ? "곧 제공될 지표" : "Coming soon"}
        </h2>
        <p className="text-sm text-muted">
          {ko
            ? "쿠폰 고객의 재방문율과 고객별 방문 여정(어떤 페이지를 거쳐 왔는지)은 방문자 식별이 필요해 준비 중입니다. 현재는 개인정보 보호를 위해 방문을 식별자 없이 집계하고 있어요. 도입되면 이 화면에 함께 표시됩니다."
            : "Repeat-visit rate for coupon customers and per-customer journeys need visitor identification and are in the works. Visits are currently counted without identifiers for privacy."}
        </p>
      </Card>

      {/* 글별 SEO 진단 */}
      <Card>
        <h2 className="mb-1 font-semibold tracking-tight">
          {ko ? "블로그 SEO 진단" : "Blog SEO audit"}
        </h2>
        <p className="mb-5 text-sm text-muted">
          {ko
            ? "글마다 검색 최적화 점수와 개선할 항목을 정리했어요. 점수가 낮은 글부터 손보면 좋아요."
            : "Per-post SEO scores and what to fix. Start with the lowest-scoring posts."}
        </p>
        <SeoAudit items={seoItems} />
      </Card>
    </div>
  );
}
