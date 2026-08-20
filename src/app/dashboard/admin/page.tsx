import { redirect } from "next/navigation";
import { getUser, getProfileName } from "@/lib/queries";
import { isCurrentUserAdmin, getPendingWithdrawals } from "@/lib/points";
import { AdminView } from "@/components/admin/AdminView";

export const metadata = { title: "관리자" };

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const admin = await isCurrentUserAdmin();
  if (!admin) redirect("/dashboard");

  await getProfileName(); // ensures profile exists
  const pending = await getPendingWithdrawals();

  return <AdminView pending={pending} />;
}
