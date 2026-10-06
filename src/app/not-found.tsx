import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { getLocale } from "@/lib/i18n";
import { getUser } from "@/lib/queries";

export default async function NotFound() {
  // 로그인 안 된 상태에서 없는 페이지(예: 홈 화면에 저장된 오래된 글 링크)로
  // 들어오면 막다른 404 대신 로그인 페이지로 바로 보낸다.
  const user = await getUser();
  if (!user) redirect("/login");

  const ko = (await getLocale()) === "ko";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <Logo />
      <div>
        <p className="text-5xl font-bold">404</p>
        <p className="mt-2 text-muted">
          {ko ? "페이지를 찾을 수 없습니다." : "Page not found."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          {ko ? "홈으로" : "Back to home"}
        </Link>
        <Link
          href="/dashboard"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground"
        >
          {ko ? "대시보드" : "Dashboard"}
        </Link>
      </div>
    </div>
  );
}
