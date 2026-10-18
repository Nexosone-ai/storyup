import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import {
  getSupporterDirectory,
  getMySupporterProfile,
  getBusinessOptions,
  getMyProjects,
  getAssignedPartnerProfile,
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
    assignedPartner,
  ] = await Promise.all([
    getSupporterDirectory(),
    getMySupporterProfile(user.id),
    getBusinessOptions(user.id),
    getMyProjects(user.id),
    isCurrentUserAdmin(),
    listAgencyServices(),
    listClientInquiries(),
    getAssignedPartnerProfile(user.id),
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
