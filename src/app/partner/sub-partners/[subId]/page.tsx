import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/queries";
import {
  listSubPartners,
  listPartnerClients,
} from "@/lib/partner";
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

  // 서브파트너가 운영하는 고객·사업장(서브의 partner_clients).
  const clients = await listPartnerClients(subId);
  const totalBiz = clients.reduce((s, c) => s + c.businesses.length, 0);

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
          {sub.email ?? ""} · 가입 고객 {clients.length}곳 · 사업장 {totalBiz}개
          {sub.status !== "active" && " · (중단됨)"}
        </p>
        <p className="mt-1 text-xs text-muted">
          랜딩·블로그·카드뉴스·이벤트·트래픽 상세 지표는 활동 모니터링에서 제공됩니다.
        </p>
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
                <span className="font-semibold">
                  {c.clientName ?? c.clientEmail ?? c.clientUserId}
                </span>
              </div>
              {c.businesses.length === 0 ? (
                <p className="text-sm text-muted">등록된 사업장이 없습니다.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {c.businesses.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium"
                    >
                      {b.name}
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
