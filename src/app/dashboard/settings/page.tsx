import { redirect } from "next/navigation";
import { getUser, getUserSiteLogos } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { ChangePasswordForm } from "@/components/dashboard/ChangePasswordForm";
import { SiteLogoManager } from "@/components/dashboard/SiteLogoManager";
import { DeleteAccountSection } from "@/components/dashboard/DeleteAccountSection";
import { getPlanById, type PlanId } from "@/lib/plans";

export const metadata = { title: "설정" };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const [{ data: profile }, siteLogos, { count: bizCount }, { count: staffCount }, { data: sub }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("name,email")
        .eq("user_id", user.id)
        .maybeSingle(),
      getUserSiteLogos(),
      supabase
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("subscriptions")
        .select("plan,status,billing_key")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
  const activePlan =
    sub?.status === "active" && sub.plan !== "free"
      ? getPlanById(sub.plan as PlanId)
      : null;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {ko ? "설정" : "Settings"}
      </h1>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">
          {ko ? "프로필" : "Profile"}
        </h2>
        <SettingsForm
          initialName={profile?.name ?? ""}
          email={profile?.email ?? user.email ?? ""}
        />
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">
          {ko ? "비밀번호 변경" : "Change password"}
        </h2>
        <p className="mb-4 text-sm text-muted">
          {ko
            ? "새 비밀번호로 로그인 정보를 바꿀 수 있어요."
            : "Update the password you use to sign in."}
        </p>
        <ChangePasswordForm />
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold">
          {ko ? "사이트 로고" : "Site logo"}
        </h2>
        <p className="mb-4 text-sm text-muted">
          {ko
            ? "사이트 헤더에 표시할 로고예요. 올리지 않으면 hero 사진이 자동으로 로고 자리에 표시돼요."
            : "The logo shown in your site header. If you don't upload one, the hero photo is used automatically."}
        </p>
        <SiteLogoManager items={siteLogos} />
      </Card>

      <Card className="border-danger/30">
        <h2 className="mb-1 text-lg font-semibold text-danger">
          {ko ? "계정 삭제" : "Delete account"}
        </h2>
        <p className="mb-4 text-sm text-muted">
          {ko
            ? "회원탈퇴 시 계정과 개인정보가 즉시 삭제됩니다."
            : "Deleting your account removes your personal data immediately."}
        </p>
        <DeleteAccountSection
          businessCount={bizCount ?? 0}
          staffCount={staffCount ?? 0}
          hasBillingKey={!!sub?.billing_key}
          planLabel={activePlan ? activePlan.name[ko ? "ko" : "en"] : null}
        />
      </Card>
    </div>
  );
}
