import type { Metadata } from "next";
import { UserGuide } from "@/components/guide/UserGuide";

export const metadata: Metadata = { title: "이용가이드" };

// 대시보드 레이아웃이 인증·셸을 제공한다. 초보자용 메뉴얼은 공용 컴포넌트로 렌더.
export default function DashboardGuidePage() {
  return <UserGuide />;
}
