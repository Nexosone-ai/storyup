import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <AuthShell
      title="다시 오신 걸 환영해요"
      subtitle="STORYUP 계정으로 로그인하세요."
      footer={
        <>
          아직 계정이 없나요?{" "}
          <Link href="/signup" className="font-medium text-primary">
            회원가입
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <div className="mt-4 text-center">
        <Link href="/reset" className="text-sm text-muted hover:text-foreground">
          비밀번호를 잊으셨나요?
        </Link>
      </div>
    </AuthShell>
  );
}
