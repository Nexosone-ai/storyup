import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Footer } from "@/components/marketing/Footer";
import { RewardsGuide } from "@/components/rewards/RewardsGuide";

export const metadata = {
  title: "UP 적립 안내",
  alternates: { canonical: "/rewards" },
};

export default function RewardsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1 px-5 py-16 sm:px-8">
        <RewardsGuide />
      </main>
      <Footer />
    </div>
  );
}
