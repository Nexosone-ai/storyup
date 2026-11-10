import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { isSubPartner } from "@/lib/partner";
import { getSubPartnerMonitor } from "@/lib/partner/monitor";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { SubPartnerManager } from "@/components/partner/SubPartnerManager";
import {
  inviteSubPartnerAction,
  setSubPartnerStatusAction,
} from "./actions";

export const metadata = { title: "파트너(영업) 관리" };

export default async function SubPartnersPage() {
  if (!B2B2C_ENABLED) notFound();
  const user = await getUser();
  if (!user) return null; // layout에서 이미 파트너 가드
  // 서브파트너는 또 서브를 만들 수 없다(깊이 2단계) — 상위파트너만.
  if (await isSubPartner(user.id)) redirect("/partner");

  const subs = await getSubPartnerMonitor(user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-2">파트너 대행</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          파트너(영업) 관리
        </h1>
        <p className="mt-1.5 text-muted">
          내 아래에 파트너(영업)을 등록해 영업망을 넓히세요. 파트너(영업)은 내가 정한
          가격을 원가로 자기 마진을 붙여 판매하며, 그들의 랜딩·블로그·카드뉴스·이벤트·트래픽
          활동을 여기서 볼 수 있어요.
        </p>
      </div>

      <SubPartnerManager
        initial={subs.map((s) => ({
          subUserId: s.subUserId,
          name: s.name,
          email: s.email,
          status: s.status,
          clientCount: s.clientCount,
          metrics: {
            sitesPublished: s.totals.sitesPublished,
            blogPublished: s.totals.blogPublished,
            cardNews: s.totals.cardNews,
            leads: s.totals.leads,
            views30d: s.totals.views30d,
          },
        }))}
        invite={inviteSubPartnerAction}
        setStatus={setSubPartnerStatusAction}
      />
    </div>
  );
}
