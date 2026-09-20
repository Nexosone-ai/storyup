import type { Metadata } from "next";
import { RewardsGuide } from "@/components/rewards/RewardsGuide";

export const metadata: Metadata = { title: "UP 적립" };

// 대시보드 레이아웃이 인증·셸을 제공한다. 보상 규칙 안내는 공용 컴포넌트를 재사용.
export default function DashboardRewardsPage() {
  return <RewardsGuide />;
}
