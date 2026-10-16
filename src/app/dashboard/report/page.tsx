import { redirect } from "next/navigation";

export const metadata = { title: "성과 리포트" };

/**
 * 성과 리포트는 사업장별 '애널리틱스'로 통합되었다(2026-10). 기존 링크는
 * 사업장 목록으로 보내 사업장을 고른 뒤 애널리틱스를 보도록 안내한다.
 */
export default function ReportRedirectPage() {
  redirect("/dashboard/businesses");
}
