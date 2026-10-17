import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/queries";
import { isCurrentUserPartner } from "@/lib/partner";
import { getLocale } from "@/lib/i18n";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";

export const metadata: Metadata = {
  title: "파트너 대행",
  robots: { index: false, follow: false },
};

/** 대행 파트너 전용 영역 — 파트너(본인 플랜=partner)만 접근. */
export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await isCurrentUserPartner())) redirect("/dashboard");
  const locale = await getLocale();

  return (
    <LocaleProvider locale={locale}>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</div>
    </LocaleProvider>
  );
}
