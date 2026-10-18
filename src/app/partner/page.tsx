import Link from "next/link";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import {
  listPartnerClients,
  getPartnerCreditBalance,
} from "@/lib/partner";
import { listPartnerInquiries, getPartnerEarnings } from "@/lib/agency";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

const INQ_STATUS: Record<string, string> = {
  open: "신규 문의",
  quoted: "견적 발행",
  paid: "결제 완료",
  in_progress: "진행중",
  done: "완료",
  cancelled: "취소",
};

export const metadata = { title: "파트너 대행" };

export default async function PartnerPage() {
  const ko = (await getLocale()) === "ko";
  const user = await getUser();
  if (!user) return null; // layout에서 이미 가드

  const [clients, credits, inquiries, earnings] = await Promise.all([
    listPartnerClients(user.id),
    getPartnerCreditBalance(user.id),
    listPartnerInquiries(user.id),
    getPartnerEarnings(user.id),
  ]);
  const totalBiz = clients.reduce((s, c) => s + c.businesses.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{ko ? "파트너 대행" : "Partner"}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {ko ? "대행 고객 관리" : "Managed clients"}
          </h1>
          <p className="mt-1.5 text-muted">
            {ko
              ? "배정받은 고객 사업장에서 AI 에이전트로 블로그·카드뉴스·SNS를 대행하세요."
              : "Run the AI agent for your assigned client businesses."}
          </p>
        </div>
        <Card className="px-4 py-3 text-right">
          <p className="text-xs text-muted">
            {ko ? "보유 패킷(크레딧)" : "Credits"}
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {credits.toLocaleString()}
          </p>
          {credits <= 0 && (
            <p className="mt-1 text-xs text-danger">
              {ko ? "관리자에게 충전 요청" : "Ask admin to top up"}
            </p>
          )}
        </Card>
        <Card className="px-4 py-3 text-right">
          <p className="text-xs text-muted">{ko ? "정산 예정 수익" : "Pending earnings"}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {earnings.pendingKrw.toLocaleString()}
            <span className="ml-0.5 text-sm">원</span>
          </p>
          {earnings.paidKrw > 0 && (
            <p className="mt-1 text-xs text-muted">
              누적 지급 {earnings.paidKrw.toLocaleString()}원
            </p>
          )}
        </Card>
      </div>

      {inquiries.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold">대행 문의</h2>
          <ul className="mt-3 space-y-1.5">
            {inquiries.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/dashboard/agency/${i.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary"
                >
                  <span className="truncate">{i.serviceLabel}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {INQ_STATUS[i.status] ?? i.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {clients.length === 0 ? (
        <Card className="flex flex-col items-start gap-2 p-8">
          <p className="font-semibold">
            {ko ? "배정된 고객이 없습니다." : "No clients assigned yet."}
          </p>
          <p className="text-sm text-muted">
            {ko
              ? "관리자가 고객 사업장을 배정하면 여기에 표시됩니다."
              : "Clients assigned by the admin will appear here."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {ko
              ? `고객 ${clients.length}곳 · 사업장 ${totalBiz}개`
              : `${clients.length} clients · ${totalBiz} businesses`}
          </p>
          {clients.map((c) => (
            <Card key={c.clientUserId} className="p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Icon.briefcase className="size-4 text-muted" />
                <span className="font-semibold">
                  {c.clientName ?? c.clientEmail ?? c.clientUserId}
                </span>
                {c.clientEmail && c.clientName && (
                  <span className="text-xs text-muted">{c.clientEmail}</span>
                )}
              </div>
              {c.businesses.length === 0 ? (
                <p className="text-sm text-muted">
                  {ko ? "등록된 사업장이 없습니다." : "No businesses."}
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {c.businesses.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm font-medium">
                        {b.name}
                      </span>
                      <span className="flex shrink-0 gap-1.5">
                        <ButtonLink
                          size="sm"
                          href={`/business/${b.id}/agent`}
                        >
                          {ko ? "에이전트" : "Agent"}
                        </ButtonLink>
                        <ButtonLink
                          size="sm"
                          variant="outline"
                          href={`/business/${b.id}`}
                        >
                          {ko ? "워크스페이스" : "Workspace"}
                        </ButtonLink>
                      </span>
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
