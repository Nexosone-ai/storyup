import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import {
  getSupporterDirectory,
  getBusinessOptions,
  getAssignedPartnerProfile,
} from "@/lib/supporters";
import { listAgencyServices, listClientInquiries } from "@/lib/agency";
import { AgencySection } from "@/components/agency/AgencySection";

export const metadata = { title: "서포터즈" };

export default async function SupportersPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [directory, businesses, agencyServices, myInquiries, assignedPartner] =
    await Promise.all([
      getSupporterDirectory(),
      getBusinessOptions(user.id),
      listAgencyServices(),
      listClientInquiries(),
      getAssignedPartnerProfile(user.id),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-2">서포터즈</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          전문가에게 의뢰하기
        </h1>
        <p className="mt-1.5 text-muted">
          필요한 분야를 고르고, 해당 분야 전문가(서포터즈)의 이력·포트폴리오를 보고
          바로 의뢰하세요. 담당 파트너와 상담 후 맞춤 견적을 받을 수 있어요.
        </p>
      </div>
      <AgencySection
        services={agencyServices}
        businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
        inquiries={myInquiries.map((i) => ({
          id: i.id,
          serviceLabel: i.serviceLabel,
          status: i.status,
          createdAt: i.createdAt,
        }))}
        assignedPartner={
          assignedPartner
            ? {
                display_name: assignedPartner.display_name,
                work_status: assignedPartner.work_status,
                history: assignedPartner.history,
                bio: assignedPartner.bio,
                portfolio_url: assignedPartner.portfolio_url,
                skills: assignedPartner.skills,
              }
            : null
        }
        availableSupporters={directory.map((d) => ({
          display_name: d.display_name,
          work_status: d.work_status,
          history: d.history,
          bio: d.bio,
          portfolio_url: d.portfolio_url,
          skills: d.skills,
        }))}
      />
    </div>
  );
}
