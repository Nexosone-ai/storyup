import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <Logo />
      <div>
        <p className="text-5xl font-bold">404</p>
        <p className="mt-2 text-muted">페이지를 찾을 수 없습니다.</p>
      </div>
      <Link
        href="/"
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
