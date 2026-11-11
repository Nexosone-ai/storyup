import Link from "next/link";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { listPartnerClients, isSubPartner } from "@/lib/partner";
import { getEntitlementBalances } from "@/lib/partner/entitlements";
import { EntitlementBalanceCard } from "@/components/partner/EntitlementBalanceCard";
import { listPartnerInquiries, getPartnerEarnings } from "@/lib/agency";
import { getMySupporterProfile } from "@/lib/supporters";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { PartnerProfileEditor } from "@/components/partner/PartnerProfileEditor";
import { ClientRegister } from "@/components/partner/ClientRegister";
import { PartnerReferralLink } from "@/components/partner/PartnerReferralLink";
import { ProvisionedAccounts } from "@/components/partner/ProvisionedAccounts";
import {
  canProvisionAccounts,
  listProvisionedAccounts,
} from "@/lib/partner/provisioning";
import { getPlanById } from "@/lib/plans";
import { ensureReferralCode } from "@/lib/gamification/referral";
import { ClientUnlinkButton } from "@/components/partner/ClientUnlinkButton";
import {
  linkPendingInvitesForPartner,
  listPendingInvites,
} from "@/lib/partner/clients";
import { savePartnerProfileAction } from "@/app/partner/actions";
import { PROVIDEO_ENABLED } from "@/lib/provideo/config";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { RECAP_SHORTS_ENABLED } from "@/lib/recapShorts/config";

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

  // 가입 대기 중이던 고객 이메일이 그 사이 가입했으면 먼저 연결한다(목록에 바로 반영).
  await linkPendingInvitesForPartner(user.id, user.email ?? "");

  const [
    clients,
    balances,
    inquiries,
    earnings,
    myProfile,
    amSub,
    pendingInvites,
    referralCode,
    canProvision,
  ] = await Promise.all([
    listPartnerClients(user.id),
    getEntitlementBalances(user.id),
    listPartnerInquiries(user.id),
    getPartnerEarnings(user.id),
    getMySupporterProfile(user.id),
    isSubPartner(user.id),
    listPendingInvites(user.id),
    ensureReferralCode(user.id),
    canProvisionAccounts(user.id),
  ]);
  // 별도계약 파트너(또는 그 서브) — 고객 계정 직접 생성(Lite) 데이터.
  const provisioned = canProvision ? await listProvisionedAccounts(user.id) : [];
  const liteLimits = getPlanById("lite").limits;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.storyup.me";
  const totalBiz = clients.reduce((s, c) => s + c.businesses.length, 0);
  // 서브파트너는 또 서브를 둘 수 없다(깊이 2단계) — 상위파트너에게만 서브파트너 메뉴 노출.
  const canManageSubs = B2B2C_ENABLED && !amSub;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">
            {amSub
              ? ko
                ? "파트너(영업)"
                : "Sales partner"
              : ko
                ? "파트너 대행"
                : "Partner"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {ko ? "대행 고객 관리" : "Managed clients"}
          </h1>
          <p className="mt-1.5 text-muted">
            {ko
              ? "고객(가맹점) 이메일을 등록해 내 고객으로 연결하고, AI 에이전트로 블로그·카드뉴스·SNS를 대행하세요."
              : "Register clients by email and run the AI agent for their businesses."}
          </p>
          <div className="mt-3">
            <ButtonLink href="/partner/guide" variant="outline" size="sm">
              <Icon.file className="size-4" />
              {ko ? "파트너 사용 매뉴얼" : "Partner guide"}
            </ButtonLink>
          </div>
        </div>
        <EntitlementBalanceCard balances={balances} ko={ko} className="min-w-56" />
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
            <li>
              · 영상 만들기 — {RECAP_SHORTS_ENABLED ? "블로그 글로 요약 쇼츠, " : ""}
              원본 영상 1개로 관련 영상 10개를 한 곳에서(작업권 사용)
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted">
            배정된 고객 사업장의 <strong>AI 에이전트</strong>에서 바로 사용할 수
            있어요(아래 고객 목록).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink size="sm" href="/partner/videos">
              {ko ? "영상 만들기" : "Make videos"}
            </ButtonLink>
            {PROVIDEO_ENABLED && (
              <ButtonLink size="sm" variant="outline" href="/partner/video">
                {ko ? "전문 영상 스튜디오" : "Pro video studio"}
              </ButtonLink>
            )}
            {B2B2C_ENABLED && (
              <ButtonLink size="sm" variant="outline" href="/partner/sales">
                {ko ? "상품 · 판매 관리" : "Products & sales"}
              </ButtonLink>
            )}
            {canManageSubs && (
              <ButtonLink
                size="sm"
                variant="outline"
                href="/partner/sub-partners"
              >
                {ko ? "파트너(영업) 관리" : "Sales partners"}
              </ButtonLink>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold">
            {ko ? "작업권 안내" : "How service credits work"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {ko
              ? "작업권은 고객이 내 상품을 결제하면 상품에 포함된 만큼 자동으로 생겨요. 따로 구매하지 않습니다."
              : "Credits are granted automatically when a client pays for your product. There is nothing to buy separately."}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>· 요약 쇼츠 1편 → 요약 쇼츠 작업권 1편</li>
            <li>· 쇼츠 장면 AI 이미지 1장 → AI 이미지 작업권 1장</li>
            <li>· 유사영상 10편 1회 → 유사영상 작업권 1회 × 길이·화질 배수</li>
            <li>· Lite 계정 생성·30일 연장 → Lite 계정 작업권 1개</li>
          </ul>
          {B2B2C_ENABLED && (
            <p className="mt-2 text-[11px] text-muted">
              <Link href="/partner/sales" className="font-medium text-primary hover:underline">
                상품 만들고 청구서 보내기 →
              </Link>
            </p>
          )}
        </Card>
      </div>

      <PartnerReferralLink
        code={referralCode}
        siteUrl={siteUrl}
        isSub={amSub}
        ko={ko}
      />

      {canProvision && (
        <ProvisionedAccounts
          accounts={provisioned}
          remaining={balances.LITE_ACCOUNT_30D}
          limits={{
            sites: liteLimits.sites ?? 1,
            blogPosts: liteLimits.blogPosts ?? 0,
            cardNews: liteLimits.cardNews ?? 0,
            shorts: liteLimits.shorts ?? 0,
          }}
          ko={ko}
        />
      )}

      <ClientRegister pending={pendingInvites} ko={ko} />

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
            {ko ? "아직 등록된 고객이 없습니다." : "No clients yet."}
          </p>
          <p className="text-sm text-muted">
            {ko
              ? "위 '고객 등록'에 고객 이메일을 입력하면 바로 여기에 표시되고 사업장을 대행할 수 있어요."
              : "Register a client email above and their businesses will appear here."}
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
                <span className="ml-auto">
                  <ClientUnlinkButton clientUserId={c.clientUserId} ko={ko} />
                </span>
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
