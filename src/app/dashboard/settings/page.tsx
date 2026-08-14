import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

export const metadata = { title: "설정" };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name,email")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">프로필</h2>
        <SettingsForm
          initialName={profile?.name ?? ""}
          email={profile?.email ?? user.email ?? ""}
        />
      </Card>
    </div>
  );
}
