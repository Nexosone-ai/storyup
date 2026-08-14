import { Logo } from "@/components/ui/Logo";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>
          <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm sm:p-8">
            <h1 className="text-[1.6rem] font-semibold tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm text-muted">{subtitle}</p>
            )}
            <div className="mt-7">{children}</div>
          </div>
          {footer && (
            <div className="mt-6 text-center text-sm text-muted">{footer}</div>
          )}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="eyebrow transition-colors hover:text-foreground"
            >
              ← 홈으로
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
