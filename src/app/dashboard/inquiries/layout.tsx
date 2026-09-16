import { redirect } from "next/navigation";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { InquiriesTabs } from "@/components/dashboard/InquiriesTabs";

export default async function InquiriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const ko = (await getLocale()) === "ko";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {ko ? "문의/쿠폰관리" : "Inquiries & coupons"}
      </h1>
      <InquiriesTabs />
      {children}
    </div>
  );
}
