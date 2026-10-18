import Link from "next/link";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import {
  listPartnerClients,
  getPartnerCreditBalance,
  listCreditPrices,
} from "@/lib/partner";
import { listPartnerInquiries, getPartnerEarnings } from "@/lib/agency";
import { getMySupporterProfile } from "@/lib/supporters";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { PartnerProfileEditor } from "@/components/partner/PartnerProfileEditor";
import { savePartnerProfileAction } from "@/app/partner/actions";

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

  const [clients, credits, inquiries, earnings, myProfile, creditPrices] =
    await Promise.all([
      listPartnerClients(user.id),
      getPartnerCreditBalance(user.id),
      listPartnerInquiries(user.id),
      getPartnerEarnings(user.id),
      getMySupporterProfile(user.id),
      listCreditPrices(),
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
          <p className="mt-1 text-[11px] text-muted">
            구매확정·입금확인 후 2주 내 정산
          </p>
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

      {/* 파트너 전용 솔루션 안내 + 패킷 사용 안내 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Icon.sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">
              {ko ? "AI 에이전트 · 영상제작 솔루션" : "AI agent & video tools"}
            </h2>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>· AI 에이전트로 블로그·카드뉴스·SNS 생성과 예약 발행을 대행</li>
            <li>· 오토파일럿으로 고객별 자동 마케팅(제안/자동 실행)</li>
            <li>· 영상제작 솔루션으로 쇼츠·홍보영상 생성(패킷 차감)</li>
          </ul>
          <p className="mt-2 text-xs text-muted">
            배정된 고객 사업장의 <strong>AI 에이전트</strong>에서 바로 사용할 수
            있어요(아래 고객 목록).
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {ko ? "이용 패킷(크레딧) 안내" : "Packet usage"}
            </h2>
            <span className="text-xs text-muted">
              보유 {credits.toLocaleString()}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {creditPrices.map((p) => (
              <li
                key={p.action}
                className="flex items-center justify-between gap-2 text-muted"
              >
                <span className="truncate">{p.label}</span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {p.credits === 0 ? "무료" : `${p.credits} 크레딧`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            패킷은 관리자가 계약 시 지급합니다. 부족하면 충전을 요청하세요.
          </p>
        </Card>
      </div>

      <PartnerProfileEditor
        action={savePartnerProfileAction}
        init={
          myProfile
            ? {
                display_name: myProfile.display_name,
                bio: myProfile.bio,
                work_status: myProfile.work_status,
                history: myProfile.history,
                portfolio_url: myProfile.portfolio_url,
                contact: myProfile.contact,
                skills: myProfile.skills,
                status: myProfile.status,
              }
            : null
        }
      />

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
