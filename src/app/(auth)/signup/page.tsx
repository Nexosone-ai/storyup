import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata = { title: "회원가입" };

export default function SignupPage() {
  return (
    <AuthShell
      title="STORYUP 시작하기"
      subtitle="이야기 하나면 충분합니다."
      footer={
        <>
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-medium text-primary">
            로그인
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
