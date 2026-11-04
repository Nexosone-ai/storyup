import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/queries";
import { listSubPartners } from "@/lib/partner";
import { getPartnerClientsActivity } from "@/lib/partner/monitor";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

export const metadata = { title: "서브파트너 활동" };

export default async function SubPartnerDetailPage({
  params,
}: {
  params: Promise<{ subId: string }>;
}) {
  if (!B2B2C_ENABLED) notFound();
  const { subId } = await params;
  const user = await getUser();
  if (!user) return null;

  // 권한 — 이 서브파트너가 내(상위파트너) 밑에 등록돼 있어야 한다.
  const subs = await listSubPartners(user.id);
  const sub = subs.find((s) => s.subUserId === subId);
  if (!sub) notFound();

  const { clients, totals } = await getPartnerClientsActivity(subId);

  const summary = [
    { label: "가입 고객", value: `${clients.length}곳` },
    { label: "사업장", value: `${totals.businesses}개` },
    { label: "발행 랜딩", value: `${totals.sitesPublished}` },
    { label: "블로그(발행)", value: `${totals.blogPublished}` },
    { label: "카드뉴스", value: `${totals.cardNews}` },
    { label: "리드(쿠폰+문의)", value: `${totals.leads}` },
    { label: "30일 조회수", value: totals.views30d.toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/partner/sub-partners"
          className="text-sm text-muted hover:text-foreground"
        >
          ← 서브파트너 목록
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {sub.name ?? sub.email ?? sub.subUserId}
        </h1>
        <p className="mt-1.5 text-muted">
          {sub.email ?? ""}
          {sub.status !== "active" && " · (중단됨)"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{t.value}</p>
          </Card>
        ))}
      </div>

      {clients.length === 0 ? (
        <Card className="p-8">
          <p className="font-semibold">아직 이 서브파트너의 고객이 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {clients.map((c) => (
            <Card key={c.clientUserId} className="p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Icon.briefcase className="size-4 text-muted" />
                <span className="font-semibold">{c.label}</span>
              </div>
              {c.businesses.length === 0 ? (
                <p className="text-sm text-muted">등록된 사업장이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {c.businesses.map((b) => (
                    <li
                      key={b.businessId}
                      className="rounded-xl border border-border bg-surface px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {b.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            b.sitePublished
                              ? "bg-success/15 text-success"
                              : "bg-surface-2 text-muted"
                          }`}
                        >
                          {b.sitePublished ? "랜딩 발행" : "랜딩 미발행"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        블로그 {b.blogPublished} · 카드뉴스 {b.cardNews} · 리드{" "}
                        {b.leads} · 30일 조회 {b.views30d.toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
