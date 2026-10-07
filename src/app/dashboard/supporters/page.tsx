import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { isCurrentUserAdmin } from "@/lib/points";
import {
  getSupporterDirectory,
  getMySupporterProfile,
  getBusinessOptions,
  getMyProjects,
} from "@/lib/supporters";
import { SupportersView } from "@/components/supporters/SupportersView";

export const metadata = { title: "서포터즈" };

export default async function SupportersPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [directory, myProfile, businesses, projects, isAdmin] =
    await Promise.all([
      getSupporterDirectory(),
      getMySupporterProfile(user.id),
      getBusinessOptions(user.id),
      getMyProjects(user.id),
      isCurrentUserAdmin(),
    ]);

  return (
    <SupportersView
      directory={directory}
      myProfile={myProfile}
      businesses={businesses}
      projects={projects}
      isAdmin={isAdmin}
    />
  );
}
