import { notFound } from "next/navigation";
import { getAllPartnersMonitor } from "@/lib/partner/monitor";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "관리자 · 파트너 현황" };

export default async function AdminPartnerMonitorPage() {
  if (!B2B2C_ENABLED) notFound();
  // /dashboard/admin/layout.tsx 에서 이미 관리자 가드됨.
  const rows = await getAllPartnersMonitor();

  const grand = rows.reduce(
    (acc, r) => {
      acc.directClients += r.directClients;
      acc.subPartners += r.subPartners;
      acc.sites += r.totals.sitesPublished;
      acc.blog += r.totals.blogPublished;
      acc.cards += r.totals.cardNews;
      acc.leads += r.totals.leads;
      acc.views += r.totals.views30d;
      return acc;
    },
    {
      directClients: 0,
      subPartners: 0,
      sites: 0,
      blog: 0,
      cards: 0,
      leads: 0,
      views: 0,
    },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold">파트너 현황 모니터링</h2>
        <p className="mt-1 text-sm text-muted">
          최상위 파트너별로 직속 고객 + 파트너(영업)의 고객 활동을 모두 합산한
          현황입니다. (읽기 전용 · 30일 조회수 기준 정렬)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "최상위 파트너", value: rows.length },
          { label: "파트너(영업)", value: grand.subPartners },
          { label: "직속 고객", value: grand.directClients },
          { label: "발행 랜딩", value: grand.sites },
          { label: "블로그(발행)", value: grand.blog },
          { label: "카드뉴스", value: grand.cards },
          { label: "리드", value: grand.leads },
          { label: "30일 조회수", value: grand.views },
        ].map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {t.value.toLocaleString()}
            </p>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card className="p-8">
          <p className="font-semibold">활성 파트너가 없습니다.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">파트너</th>
                <th className="px-3 py-2 text-right font-medium">서브</th>
                <th className="px-3 py-2 text-right font-medium">사업장</th>
                <th className="px-3 py-2 text-right font-medium">랜딩</th>
                <th className="px-3 py-2 text-right font-medium">블로그</th>
                <th className="px-3 py-2 text-right font-medium">카드뉴스</th>
                <th className="px-3 py-2 text-right font-medium">리드</th>
                <th className="px-3 py-2 text-right font-medium">30일 조회</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.partnerUserId}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="py-2.5 pr-3">
                    <p className="font-medium">
                      {r.name ?? r.email ?? r.partnerUserId.slice(0, 8)}
                    </p>
                    {r.name && r.email && (
                      <p className="text-xs text-muted">{r.email}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.subPartners}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.totals.businesses}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.totals.sitesPublished}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.totals.blogPublished}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.totals.cardNews}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.totals.leads}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.totals.views30d.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
