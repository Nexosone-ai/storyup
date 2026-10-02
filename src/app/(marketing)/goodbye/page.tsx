import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { getDict } from "@/lib/i18n";

export const metadata = { title: "계정 삭제 완료" };

/** 회원탈퇴 직후 안내. 세션은 이미 정리된 상태로 도달한다. */
export default async function GoodbyePage() {
  const { locale } = await getDict();
  const ko = locale === "ko";
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {ko ? "계정이 삭제되었습니다" : "Your account has been deleted"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {ko
              ? "계정과 개인정보가 삭제되었습니다. 법령상 보존 의무가 있는 결제 기록은 개인정보처리방침에 따라 분리 보관 후 파기됩니다. 그동안 STORYUP을 이용해주셔서 감사합니다."
              : "Your account and personal data have been deleted. Payment records required by law are kept separately per our privacy policy and then destroyed. Thank you for using STORYUP."}
          </p>
          <div className="mt-8 flex justify-center gap-3 text-sm">
            <Link href="/" className="font-medium text-primary">
              {ko ? "홈으로" : "Back to home"}
            </Link>
            <Link href="/privacy#data-deletion" className="text-muted hover:text-foreground">
              {ko ? "개인정보처리방침" : "Privacy policy"}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
