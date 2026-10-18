import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import {
  getSupporterDirectory,
  getMySupporterProfile,
  getBusinessOptions,
  getMyProjects,
} from "@/lib/supporters";
import { listAgencyServices, listClientInquiries } from "@/lib/agency";
import { SupportersView } from "@/components/supporters/SupportersView";
import { AgencySection } from "@/components/agency/AgencySection";

export const metadata = { title: "서포터즈" };

export default async function SupportersPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [
    directory,
    myProfile,
    businesses,
    projects,
    isAdmin,
    agencyServices,
    myInquiries,
  ] = await Promise.all([
    getSupporterDirectory(),
    getMySupporterProfile(user.id),
    getBusinessOptions(user.id),
    getMyProjects(user.id),
    isCurrentUserAdmin(),
    listAgencyServices(),
    listClientInquiries(),
  ]);

  return (
    <div>
      <AgencySection
        services={agencyServices}
        businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
        inquiries={myInquiries.map((i) => ({
          id: i.id,
          serviceLabel: i.serviceLabel,
          status: i.status,
          createdAt: i.createdAt,
        }))}
      />
      <SupportersView
        directory={directory}
        myProfile={myProfile}
        businesses={businesses}
        projects={projects}
        isAdmin={isAdmin}
      />
    </div>
  );
}
