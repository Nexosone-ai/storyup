import { getMembersAdmin } from "@/lib/admin/members";
import { AdminMembers } from "@/components/admin/AdminMembersView";

export const metadata = { title: "관리자 · 회원" };

export default async function AdminMembersPage() {
  const members = await getMembersAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <AdminMembers members={members.members} total={members.total} />
    </div>
  );
}
