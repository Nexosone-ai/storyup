import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/AuthForms";
import { getDict } from "@/lib/i18n";

export const metadata = { title: "비밀번호 재설정" };

export default async function ResetPage() {
  const { t } = await getDict();
  const a = t.auth;
  return (
    <AuthShell
      title={a.resetTitle}
      subtitle={a.resetSub}
      homeLabel={a.home}
      footer={
        <Link href="/login" className="font-medium text-primary">
          {a.backLogin}
        </Link>
      }
    >
      <ResetForm t={a} />
    </AuthShell>
  );
}
