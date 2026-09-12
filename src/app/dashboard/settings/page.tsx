import { redirect } from "next/navigation";
import { getUser, getUserSiteLogos } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { ChangePasswordForm } from "@/components/dashboard/ChangePasswordForm";
import { SiteLogoManager } from "@/components/dashboard/SiteLogoManager";

export const metadata = { title: "설정" };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const ko = (await getLocale()) === "ko";
  const supabase = await createClient();
  const [{ data: profile }, siteLogos] = await Promise.all([
    supabase
      .from("profiles")
      .select("name,email")
      .eq("user_id", user.id)
      .maybeSingle(),
    getUserSiteLogos(),
  ]);

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
    </div>
  );
}
