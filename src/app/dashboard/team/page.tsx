import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPlanId } from "@/lib/subscription";
import { getPlanById } from "@/lib/plans";
import { TeamManager } from "@/components/dashboard/TeamManager";

export const metadata = { title: "팀 관리" };

export interface TeamMemberRow {
  id: string;
  email: string;
  status: "pending" | "active";
}
export interface ReceivedInvite {
  id: string;
  ownerLabel: string;
  status: "pending" | "active";
}

export default async function TeamPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const ko = (await getLocale()) === "ko";
  const email = (user.email ?? "").toLowerCase();
  const supabase = await createClient();

  // 내가 직원인지(다른 소유자의 활성 멤버) 여부
  const { data: ownerData } = await supabase.rpc("account_owner_id", {
    p_user: user.id,
  });
  const isStaff =
    typeof ownerData === "string" && !!ownerData && ownerData !== user.id;

  const plan = getPlanById(await getPlanId(user.id));

  // 내가 소유자로서 관리하는 팀
  const { data: teamRows } = await supabase
    .from("team_members")
    .select("id, invited_email, status")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });
  const team: TeamMemberRow[] = (teamRows ?? []).map((r) => ({
    id: r.id,
    email: r.invited_email,
    status: r.status,
  }));

  // 나에게 온 초대(내 이메일, pending) + 내가 연결된 활성 멤버십
  const { data: inviteRows } = await supabase
    .from("team_members")
    .select("id, owner_user_id, status, member_user_id, invited_email")
    .or(`member_user_id.eq.${user.id},invited_email.eq.${email}`);
  const relevant = (inviteRows ?? []).filter(
    (r) =>
      (r.status === "pending" && r.invited_email.toLowerCase() === email) ||
      (r.status === "active" && r.member_user_id === user.id),
  );

  // 초대한 소유자 표시명 (profiles.name) — 교차 사용자라 admin으로 조회
  let ownerLabels = new Map<string, string>();
  if (relevant.length) {
    const admin = createAdminClient();
    const ids = [...new Set(relevant.map((r) => r.owner_user_id))];
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id, name")
      .in("user_id", ids);
    ownerLabels = new Map(
      (profs ?? []).map((p) => [p.user_id, p.name ?? "STORYUP 사용자"]),
    );
  }
  const received: ReceivedInvite[] = relevant.map((r) => ({
    id: r.id,
    ownerLabel: ownerLabels.get(r.owner_user_id) ?? "STORYUP 사용자",
    status: r.status,
  }));

  const canManage = !isStaff && (plan.maxMembers === null || plan.maxMembers > 1);
  const seatLabel =
    plan.maxMembers === null
      ? ko
        ? "협의"
        : "Custom"
      : `${plan.maxMembers}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko ? "팀 관리" : "Team"}
        </h1>
        <p className="mt-1.5 text-muted">
          {ko
            ? "직원을 초대해 사업장(브랜드·사이트·블로그·문의·분석)을 함께 관리하세요. 결제·플랜·팀 관리는 소유자만 할 수 있어요."
            : "Invite staff to manage your businesses together. Billing and team settings stay with the owner."}
        </p>
      </div>
      <TeamManager
        ko={ko}
        canManage={canManage}
        isStaff={isStaff}
        seatLabel={seatLabel}
        usedSeats={1 + team.length}
        team={team}
        received={received}
      />
    </div>
  );
}
