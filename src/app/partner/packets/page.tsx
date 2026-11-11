import Link from "next/link";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { getEntitlementBalances } from "@/lib/partner/entitlements";
import { EntitlementBalanceCard } from "@/components/partner/EntitlementBalanceCard";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "패킷 제도 종료",
  robots: { index: false, follow: false },
};

/**
 * 패킷 구매 화면 — 2026-11-11 패킷 제도 종료. 북마크·구 링크로 들어온 파트너에게 작업권 안내만 보여준다.
 * (구매 UI·액션은 PR2 에서 삭제.)
 */
export default async function PartnerPacketsPage() {
  const ko = (await getLocale()) === "ko";
  const user = await getUser();
  if (!user) return null; // layout에서 이미 가드
  const balances = await getEntitlementBalances(user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-2">{ko ? "파트너 대행" : "Partner"}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "패킷 제도가 종료되었어요" : "Packets have been retired"}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "이제 패킷을 따로 구매하지 않습니다. 고객에게 상품을 판매(결제)하면 상품에 포함된 작업권이 자동으로 생기고, 요약 쇼츠·유사영상·Lite 계정 생성은 그 작업권을 사용해요. 남아 있던 패킷은 작업권으로 바꿔 드렸어요."
            : "Packets are no longer sold. When a client pays for your product, the included service credits are granted automatically and used by recap shorts, similar videos and Lite accounts. Any remaining packets were converted to credits."}
        </p>
      </div>
      <EntitlementBalanceCard balances={balances} ko={ko} className="max-w-sm" />
      <Card className="p-4 text-sm text-muted">
        <Link href="/partner/sales" className="font-medium text-primary hover:underline">
          {ko ? "상품 만들고 청구서 보내기 →" : "Create a product and send an invoice →"}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/partner" className="font-medium text-primary hover:underline">
          {ko ? "파트너 홈" : "Partner home"}
        </Link>
      </Card>
    </div>
  );
}
