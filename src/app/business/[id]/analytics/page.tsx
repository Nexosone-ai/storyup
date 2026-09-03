import { notFound } from "next/navigation";
import { getBusiness, getWebsite, getBlogPosts } from "@/lib/queries";
import { getAnalytics } from "@/lib/analytics";
import { getLocale } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/utils/cn";

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

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ko = (await getLocale()) === "ko";
  const business = await getBusiness(id);
  if (!business) notFound();

  const [website, posts, data] = await Promise.all([
    getWebsite(id),
    getBlogPosts(id),
    getAnalytics(id),
  ]);

  const slugToTitle = new Map(posts.map((p) => [p.slug, p.title]));
  const published = website?.status === "published";
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.views));

  const stats = [
    {
      label: ko ? "전체 조회수" : "Total views",
      value: data.totalViews.toLocaleString(),
    },
    {
      label: ko ? "최근 30일 조회수" : "Views (last 30 days)",
      value: data.views30d.toLocaleString(),
    },
    {
      label: ko ? "최근 30일 공유" : "Shares (last 30 days)",
      value: data.shares30d.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-2">{ko ? "애널리틱스" : "Analytics"}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "방문·공유 지표" : "Traffic & sharing"}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "공개 랜딩페이지와 블로그의 실제 조회수·유입 경로·공유 현황입니다."
            : "Real views, referrers, and shares for your live landing page and blog."}
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

      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm sm:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={
              i < 2
                ? "border-b border-border p-6 sm:border-b-0 sm:border-r"
                : "p-6"
            }
          >
            <p className="text-sm text-muted">{s.label}</p>
            <p className="tnum mt-2 text-3xl font-semibold tracking-tight">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* 최근 14일 일별 조회수 */}
      <Card>
        <h2 className="mb-5 font-semibold tracking-tight">
          {ko ? "최근 14일 조회수" : "Views (last 14 days)"}
        </h2>
        <div className="flex h-36 items-end gap-1.5">
          {data.daily.map((d) => (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 flex-col justify-end"
              title={`${d.date} · ${d.views}${ko ? "회" : " views"}`}
            >
              <div
                className={cn(
                  "rounded-t-md transition-colors",
                  d.views > 0
                    ? "bg-primary/70 group-hover:bg-primary"
                    : "bg-surface-muted",
                )}
                style={{
                  height: `${d.views > 0 ? Math.max(6, (d.views / maxDaily) * 100) : 4}%`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{data.daily[0]?.date.slice(5)}</span>
          <span>{data.daily.at(-1)?.date.slice(5)}</span>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 페이지별 조회수 */}
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

        {/* 유입 경로 */}
        <Card>
          <h2 className="mb-4 font-semibold tracking-tight">
            {ko ? "유입 경로 (30일)" : "Referrers (30 days)"}
          </h2>
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
                <span className="text-sm">
                  {channelLabel(s.channel, ko)}
                </span>
                <span className="tnum text-sm font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
