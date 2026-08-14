import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/AuthForms";

export const metadata = { title: "비밀번호 재설정" };

export default function ResetPage() {
  return (
    <AuthShell
      title="비밀번호 재설정"
      subtitle="가입한 이메일로 재설정 링크를 보내드립니다."
      footer={
        <Link href="/login" className="font-medium text-primary">
          ← 로그인으로 돌아가기
        </Link>
      }
    >
      <ResetForm />
    </AuthShell>
  );
}
