import { getMembersAdmin } from "@/lib/admin/members";
import { getWithdrawalsAdmin } from "@/lib/admin/withdrawals";
import { AdminMembers } from "@/components/admin/AdminMembersView";
import { AdminWithdrawalsView } from "@/components/admin/AdminWithdrawalsView";

export const metadata = { title: "관리자 · 회원" };

export default async function AdminMembersPage() {
  const [members, withdrawals] = await Promise.all([
    getMembersAdmin(),
    getWithdrawalsAdmin(),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <AdminMembers members={members.members} total={members.total} />
      <AdminWithdrawalsView data={withdrawals} />
    </div>
  );
}
