import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getMySupporterProfile } from "@/lib/supporters";
import { PartnerProfileEditor } from "@/components/partner/PartnerProfileEditor";
import { applySupporterAction } from "./actions";

export const metadata = { title: "서포터즈 신청" };

export default async function SupporterApplyPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const profile = await getMySupporterProfile(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="eyebrow mb-2">서포터즈</p>
        <h1 className="text-2xl font-semibold tracking-tight">서포터즈 신청</h1>
        <p className="mt-1.5 text-muted">
          작업 현황·이력을 등록해 신청하면 <strong>관리자 최종 승인</strong> 후
          서포터즈에 노출되고 대행 문의를 받을 수 있어요. 수익 정산은 고객 구매
          확정·입금 확인 후 <strong>2주 이내</strong> 처리됩니다.
        </p>
      </div>
      <PartnerProfileEditor
        action={applySupporterAction}
        heading="신청 정보"
        intro="아래 정보로 서포터즈 신청이 접수됩니다. 승인 후 클라이언트에게 노출돼요."
        init={
          profile
            ? {
                display_name: profile.display_name,
                bio: profile.bio,
                work_status: profile.work_status,
                history: profile.history,
                portfolio_url: profile.portfolio_url,
                contact: profile.contact,
                skills: profile.skills,
                status: profile.status,
              }
            : null
        }
      />
    </div>
  );
}
