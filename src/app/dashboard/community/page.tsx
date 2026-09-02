import { redirect } from "next/navigation";

/** 커뮤니티는 공개 페이지(/community)로 이동했다 — 북마크 호환용 리다이렉트. */
export default function DashboardCommunityRedirect() {
  redirect("/community");
}
