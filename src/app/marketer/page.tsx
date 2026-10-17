import { redirect } from "next/navigation";

/** 마케터 전용 진입경로 — 기존 마케터 영역으로 보냄(멤버 가드는 그쪽 페이지). */
export default function MarketerEntry() {
  redirect("/dashboard/marketer");
}
