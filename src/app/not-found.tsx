import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { getLocale } from "@/lib/i18n";

export default async function NotFound() {
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
          href="/login"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground"
        >
          {ko ? "로그인" : "Log in"}
        </Link>
      </div>
    </div>
  );
}
