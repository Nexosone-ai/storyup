import { notFound } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { loadThread, listAgencyServices, listDeliverables } from "@/lib/agency";
import { getSupporterProfileByUser } from "@/lib/supporters";
import { AgencyThread } from "@/components/agency/AgencyThread";
import { SupporterProfileCard } from "@/components/agency/SupporterProfileCard";

export const metadata = { title: "대행 문의" };

export default async function AgencyThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ko = (await getLocale()) === "ko";
  const user = await getUser();
  if (!user) notFound();

  const { inquiry, messages } = await loadThread(id);
  if (!inquiry) notFound();

  const isPartnerView = inquiry.partnerUserId === user.id;
  const services = await listAgencyServices();
  const supply =
    services.find((s) => s.key === inquiry.serviceKey)?.supplyPriceKrw ?? 0;

  // 클라이언트에게 담당 파트너(서포터) 프로필을 보여준다.
  const partnerProfile =
    !isPartnerView && inquiry.partnerUserId
      ? await getSupporterProfileByUser(inquiry.partnerUserId)
      : null;

  const deliverables = await listDeliverables(inquiry.businessId);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {partnerProfile && (
        <SupporterProfileCard
          profile={{
            display_name: partnerProfile.display_name,
            work_status: partnerProfile.work_status,
            history: partnerProfile.history,
            bio: partnerProfile.bio,
            portfolio_url: partnerProfile.portfolio_url,
            skills: partnerProfile.skills,
          }}
          heading="담당 파트너"
        />
      )}
      <AgencyThread
        inquiry={inquiry}
        messages={messages}
        meId={user.id}
        isPartnerView={isPartnerView}
        supplyPriceKrw={supply}
        deliverables={deliverables}
        ko={ko}
      />
    </div>
  );
}
