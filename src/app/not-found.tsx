import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { getLocale } from "@/lib/i18n";
import { getUser } from "@/lib/queries";
import { LoginRedirect } from "@/components/auth/LoginRedirect";

export default async function NotFound() {
  const ko = (await getLocale()) === "ko";

  // 로그인 안 된 상태에서 없는 페이지(예: 홈 화면에 저장된 오래된 글 링크)로
  // 들어오면 막다른 404 대신 로그인 페이지로 바로 보낸다. 서버 redirect()는
  // 매칭된 라우트의 notFound()에서 하드 내비게이션에 안 먹으므로 클라이언트에서 이동.
  const user = await getUser();
  if (!user)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5 text-center">
        <LoginRedirect to="/login" />
        <Logo />
        <p className="text-sm text-muted">
          {ko ? "로그인 페이지로 이동 중…" : "Redirecting to login…"}
        </p>
      </div>
    );

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
