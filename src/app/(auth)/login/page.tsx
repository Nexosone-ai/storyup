import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";
import { getDict } from "@/lib/i18n";

export const metadata = { title: "로그인" };

export default async function LoginPage() {
  const { t } = await getDict();
  const a = t.auth;
  return (
    <AuthShell
      title={a.loginTitle}
      subtitle={a.loginSub}
      homeLabel={a.home}
      footer={
        <>
          {a.noAccount}{" "}
          <Link href="/signup" className="font-medium text-primary">
            {a.toSignup}
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginForm t={a} />
      </Suspense>
      <div className="mt-4 text-center">
        <Link href="/reset" className="text-sm text-muted hover:text-foreground">
          {a.forgot}
        </Link>
      </div>
    </AuthShell>
  );
}
