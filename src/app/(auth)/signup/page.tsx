import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/AuthForms";
import { getDict } from "@/lib/i18n";

export const metadata = { title: "회원가입" };

export default async function SignupPage() {
  const { t } = await getDict();
  const a = t.auth;
  return (
    <AuthShell
      title={a.signupTitle}
      subtitle={a.signupSub}
      homeLabel={a.home}
      footer={
        <>
          {a.haveAccount}{" "}
          <Link href="/login" className="font-medium text-primary">
            {a.toLogin}
          </Link>
        </>
      }
    >
      <SignupForm t={a} />
    </AuthShell>
  );
}
