import { notFound } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { loadThread, listAgencyServices } from "@/lib/agency";
import { AgencyThread } from "@/components/agency/AgencyThread";

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

  return (
    <div className="mx-auto max-w-2xl">
      <AgencyThread
        inquiry={inquiry}
        messages={messages}
        meId={user.id}
        isPartnerView={isPartnerView}
        supplyPriceKrw={supply}
        ko={ko}
      />
    </div>
  );
}
