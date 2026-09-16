import { Card } from "@/components/ui/Card";
import { TrendChart } from "@/components/analytics/TrendChart";
import type { AdminTraffic } from "@/lib/admin/traffic";

function Badge({ pct }: { pct: number }) {
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
      title="직전 30일 대비"
    >
      {up ? "▲" : down ? "▼" : "–"} {Math.abs(pct)}%
    </span>
  );
}

/** 관리자 전체 트래픽 대시보드 (플랫폼 합산). */
export function AdminTrafficView({ data }: { data: AdminTraffic }) {
  const stats = [
    {
      label: "전체 조회수",
      value: data.totalViews.toLocaleString(),
      sub: `누적`,
    },
    {
      label: "조회수 (30일)",
      value: data.views30d.toLocaleString(),
      badge: data.viewsGrowthPct,
      sub: `직전 ${data.viewsPrev30d.toLocaleString()}`,
    },
    {
      label: "활성 사업체 (30일)",
      value: data.activeBusinesses30d.toLocaleString(),
      sub: "방문 발생 사업체",
    },
    {
      label: "공유 (30일)",
      value: data.shares30d.toLocaleString(),
      sub: "콘텐츠 공유",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">전체 트래픽</h2>
        <p className="mt-0.5 text-sm text-muted">
          모든 사업체의 랜딩페이지·블로그 방문을 합산한 플랫폼 지표예요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-sm text-muted">{s.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="tnum text-2xl font-semibold tracking-tight">
                {s.value}
              </p>
              {s.badge !== undefined && <Badge pct={s.badge} />}
            </div>
            <p className="mt-1 text-xs text-muted">{s.sub}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold tracking-tight">방문 추이 (최근 30일)</h3>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>최근 7일</span>
            <span className="tnum font-semibold text-foreground">
              {data.views7d}
            </span>
            <Badge pct={data.views7dGrowthPct} />
          </div>
        </div>
        <TrendChart data={data.trend} ko />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-semibold tracking-tight">
            사업체별 조회수 (30일)
          </h3>
          {data.topBusinesses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              아직 수집된 조회가 없어요.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {data.topBusinesses.map((b) => (
                <li key={b.businessId} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {b.name}
                  </span>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className="block h-full rounded-full bg-primary/70"
                      style={{
                        width: `${(b.views / data.topBusinesses[0].views) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="tnum w-12 text-right text-sm font-medium">
                    {b.views}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 font-semibold tracking-tight">유입 경로 (30일)</h3>
          {data.referrers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              아직 수집된 유입이 없어요.
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
                  <span className="tnum w-12 text-right text-sm font-medium">
                    {r.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
