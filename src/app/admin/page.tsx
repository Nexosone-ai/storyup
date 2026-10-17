import { redirect } from "next/navigation";

/** 관리자 전용 진입경로 — 기존 관리자 영역으로 보냄(영역 가드는 그쪽 레이아웃). */
export default function AdminEntry() {
  redirect("/dashboard/admin");
}
