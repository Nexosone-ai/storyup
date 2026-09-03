import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { UpdatePasswordForm } from "@/components/auth/AuthForms";
import { getDict } from "@/lib/i18n";

export const metadata = { title: "새 비밀번호 설정" };

export default async function UpdatePasswordPage() {
  const { t } = await getDict();
  const a = t.auth;
  return (
    <AuthShell
      title={a.updateTitle}
      subtitle={a.updateSub}
      homeLabel={a.home}
      footer={
        <Link href="/login" className="font-medium text-primary">
          {a.backLogin}
        </Link>
      }
    >
      <UpdatePasswordForm t={a} />
    </AuthShell>
  );
}
